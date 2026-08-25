'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function getAccessories(category?: string) {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('accessories')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

// ===== Stock por bodega =====
// accessories.stock se mantiene como el TOTAL, recalculado aquí mismo cada vez
// que cambian las filas de accessory_bodega_stock de un accesorio.

export async function getAccessoryBodegaStock(accessoryId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('accessory_bodega_stock')
    .select('bodega, stock')
    .eq('accessory_id', accessoryId)
    .order('bodega')
  if (error) return []
  return data
}

async function recomputeAccessoryStockTotal(accessoryId: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('accessory_bodega_stock')
    .select('stock')
    .eq('accessory_id', accessoryId)
  const total = (data || []).reduce((sum, r) => sum + r.stock, 0)
  await supabase.from('accessories').update({ stock: total }).eq('id', accessoryId)
  return total
}

export async function replaceAccessoryBodegaStock(accessoryId: string, entries: { bodega: string; stock: number }[]) {
  const authError = await requireAdmin()
  if (authError) return { error: authError.error }
  const supabase = await createServerSupabaseClient()

  const { error: delError } = await supabase.from('accessory_bodega_stock').delete().eq('accessory_id', accessoryId)
  if (delError) return { error: delError.message }

  // No filtramos por stock > 0: una bodega marcada con 0 sigue siendo una
  // asignación real (se sigue vendiendo/reabasteciendo ahí), solo se omiten
  // las bodegas que ni siquiera se marcaron en el formulario.
  const rows = entries.map(e => ({ accessory_id: accessoryId, bodega: e.bodega, stock: e.stock }))
  if (rows.length > 0) {
    const { error: insError } = await supabase.from('accessory_bodega_stock').insert(rows)
    if (insError) return { error: insError.message }
  }

  await recomputeAccessoryStockTotal(accessoryId)
  revalidatePath('/complementos')
  revalidatePath(`/complementos/${accessoryId}`)
  revalidatePath('/inventario')
  revalidatePath('/')
  return { success: true }
}

export async function adjustAccessoryBodegaStock(accessoryId: string, bodega: string, newStock: number) {
  const authError = await requireAdmin()
  if (authError) return { error: authError.error }
  if (newStock < 0) return { error: 'El stock no puede ser negativo' }
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('accessory_bodega_stock')
    .upsert({ accessory_id: accessoryId, bodega, stock: newStock }, { onConflict: 'accessory_id,bodega' })

  if (error) return { error: error.message }

  const total = await recomputeAccessoryStockTotal(accessoryId)
  revalidatePath('/complementos')
  revalidatePath(`/complementos/${accessoryId}`)
  revalidatePath('/inventario')
  revalidatePath('/')
  return { success: true, total }
}

function parseBodegaEntries(formData: FormData) {
  return formData.getAll('bodega_nombre').map((bodega, i) => ({
    bodega: bodega as string,
    stock: parseInt(formData.getAll('bodega_stock')[i] as string) || 0,
  }))
}

export async function createAccessory(formData: FormData) {
  const authError = await requireAdmin()
  if (authError) return { error: authError.error }
  const supabase = await createServerSupabaseClient()

  // Image is uploaded client-side; we just receive the resulting public URL
  const imageUrl = (formData.get('image_url') as string) || null
  const bodegaEntries = parseBodegaEntries(formData)
  const totalStock = bodegaEntries.reduce((sum, e) => sum + e.stock, 0)

  const { data, error } = await supabase.from('accessories').insert({
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    category: formData.get('category') as string,
    brand: (formData.get('brand') as string) || null,
    weight: (formData.get('weight') as string) || null,
    color: (formData.get('color') as string) || null,
    sku: (formData.get('sku') as string) || null,
    stock: totalStock,
    price: parseFloat(formData.get('price') as string) || null,
    image_url: imageUrl,
  }).select('id').single()

  if (error) return { error: error.message }

  const rows = bodegaEntries.map(e => ({ accessory_id: data.id, bodega: e.bodega, stock: e.stock }))
  if (rows.length > 0) await supabase.from('accessory_bodega_stock').insert(rows)

  revalidatePath('/complementos')
  revalidatePath('/')
  return { success: true }
}

export async function updateAccessory(id: string, formData: FormData) {
  const authError = await requireAdmin()
  if (authError) return { error: authError.error }
  const supabase = await createServerSupabaseClient()

  const imageUrl = (formData.get('image_url') as string) || null
  const bodegaEntries = parseBodegaEntries(formData)
  const totalStock = bodegaEntries.reduce((sum, e) => sum + e.stock, 0)

  const { error } = await supabase.from('accessories').update({
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    category: formData.get('category') as string,
    brand: (formData.get('brand') as string) || null,
    weight: (formData.get('weight') as string) || null,
    color: (formData.get('color') as string) || null,
    sku: (formData.get('sku') as string) || null,
    stock: totalStock,
    price: parseFloat(formData.get('price') as string) || null,
    image_url: imageUrl || undefined,
  }).eq('id', id)

  if (error) return { error: error.message }

  await replaceAccessoryBodegaStock(id, bodegaEntries)

  revalidatePath('/complementos')
  revalidatePath(`/complementos/${id}/editar`)
  revalidatePath('/')
  return { success: true }
}

export async function deleteAccessory(id: string) {
  const authError = await requireAdmin()
  if (authError) return { error: authError.error }
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('accessories').update({ is_active: false }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/complementos')
  revalidatePath('/')
  return { success: true }
}
