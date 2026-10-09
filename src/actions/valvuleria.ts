'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/adminClient'
import { requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function getValvuleria() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('valvuleria')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getValvuleriaItem(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('valvuleria')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// ===== Stock por bodega =====
// valvuleria.stock se mantiene como el TOTAL, recalculado aquí mismo cada vez
// que cambian las filas de valvuleria_bodega_stock de un producto.

export async function getValvuleriaBodegaStock(valvuleriaId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('valvuleria_bodega_stock')
    .select('bodega, stock')
    .eq('valvuleria_id', valvuleriaId)
    .order('bodega')
  if (error) return []
  return data
}

async function recomputeValvuleriaStockTotal(valvuleriaId: string) {
  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('valvuleria_bodega_stock')
    .select('stock')
    .eq('valvuleria_id', valvuleriaId)
  const total = (data || []).reduce((sum, r) => sum + r.stock, 0)
  await supabase.from('valvuleria').update({ stock: total }).eq('id', valvuleriaId)
  return total
}

export async function replaceValvuleriaBodegaStock(valvuleriaId: string, entries: { bodega: string; stock: number }[]) {
  const authError = await requireAdmin()
  if (authError) return { error: authError.error }
  const supabase = createAdminSupabaseClient()

  const { error: delError } = await supabase.from('valvuleria_bodega_stock').delete().eq('valvuleria_id', valvuleriaId)
  if (delError) return { error: delError.message }

  // No filtramos por stock > 0: una bodega marcada con 0 sigue siendo una
  // asignación real (se sigue vendiendo/reabasteciendo ahí), solo se omiten
  // las bodegas que ni siquiera se marcaron en el formulario.
  const rows = entries.map(e => ({ valvuleria_id: valvuleriaId, bodega: e.bodega, stock: e.stock }))
  if (rows.length > 0) {
    const { error: insError } = await supabase.from('valvuleria_bodega_stock').insert(rows)
    if (insError) return { error: insError.message }
  }

  await recomputeValvuleriaStockTotal(valvuleriaId)
  revalidatePath('/valvuleria')
  revalidatePath(`/valvuleria/${valvuleriaId}`)
  revalidatePath('/inventario')
  revalidatePath('/')
  return { success: true }
}

export async function adjustValvuleriaBodegaStock(valvuleriaId: string, bodega: string, newStock: number) {
  const authError = await requireAdmin()
  if (authError) return { error: authError.error }
  if (newStock < 0) return { error: 'El stock no puede ser negativo' }
  const supabase = createAdminSupabaseClient()

  const { error } = await supabase
    .from('valvuleria_bodega_stock')
    .upsert({ valvuleria_id: valvuleriaId, bodega, stock: newStock }, { onConflict: 'valvuleria_id,bodega' })

  if (error) return { error: error.message }

  const total = await recomputeValvuleriaStockTotal(valvuleriaId)
  revalidatePath('/valvuleria')
  revalidatePath(`/valvuleria/${valvuleriaId}`)
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

export async function createValvuleria(formData: FormData) {
  const authError = await requireAdmin()
  if (authError) return { error: authError.error }
  const supabase = createAdminSupabaseClient()

  // Image is uploaded client-side; we just receive the resulting public URL
  const imageUrl = (formData.get('image_url') as string) || null
  const bodegaEntries = parseBodegaEntries(formData)
  const totalStock = bodegaEntries.reduce((sum, e) => sum + e.stock, 0)

  const { data, error } = await supabase.from('valvuleria').insert({
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    brand: (formData.get('brand') as string) || null,
    sku: (formData.get('sku') as string) || null,
    stock: totalStock,
    price: parseFloat(formData.get('price') as string) || null,
    image_url: imageUrl,
  }).select('id').single()

  if (error) return { error: error.message }

  const rows = bodegaEntries.map(e => ({ valvuleria_id: data.id, bodega: e.bodega, stock: e.stock }))
  if (rows.length > 0) await supabase.from('valvuleria_bodega_stock').insert(rows)

  revalidatePath('/valvuleria')
  revalidatePath('/')
  return { success: true }
}

export async function updateValvuleria(id: string, formData: FormData) {
  const authError = await requireAdmin()
  if (authError) return { error: authError.error }
  const supabase = createAdminSupabaseClient()

  const imageUrl = (formData.get('image_url') as string) || null
  const bodegaEntries = parseBodegaEntries(formData)
  const totalStock = bodegaEntries.reduce((sum, e) => sum + e.stock, 0)

  const { error } = await supabase.from('valvuleria').update({
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    brand: (formData.get('brand') as string) || null,
    sku: (formData.get('sku') as string) || null,
    stock: totalStock,
    price: parseFloat(formData.get('price') as string) || null,
    image_url: imageUrl || undefined,
  }).eq('id', id)

  if (error) return { error: error.message }

  await replaceValvuleriaBodegaStock(id, bodegaEntries)

  revalidatePath('/valvuleria')
  revalidatePath(`/valvuleria/${id}/editar`)
  revalidatePath('/')
  return { success: true }
}

export async function deleteValvuleria(id: string) {
  const authError = await requireAdmin()
  if (authError) return { error: authError.error }
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('valvuleria').update({ is_active: false }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/valvuleria')
  revalidatePath('/')
  return { success: true }
}
