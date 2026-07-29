'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getProducts(filters?: {
  material?: string
  brand_id?: string
  size_id?: string
  search?: string
}) {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('products')
    .select('*, brand:brands(*), size:sizes(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (filters?.material) query = query.eq('material', filters.material)
  if (filters?.brand_id) query = query.eq('brand_id', filters.brand_id)
  if (filters?.size_id) query = query.eq('size_id', filters.size_id)
  if (filters?.search) query = query.ilike('name', `%${filters.search}%`)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getProduct(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select('*, brand:brands(*), size:sizes(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function findProductsByName(name: string, excludeId?: string) {
  const trimmed = name.trim()
  if (!trimmed) return []

  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('products')
    .select('id, name, brand:brands(name), size:sizes(label)')
    .ilike('name', trimmed)
    .eq('is_active', true)
    .limit(5)

  if (excludeId) query = query.neq('id', excludeId)

  const { data, error } = await query
  if (error) return []
  return data
}

// ===== Stock por bodega =====
// products.stock se mantiene como el TOTAL, recalculado aquí mismo cada vez
// que cambian las filas de product_bodega_stock de un producto.

export async function getProductBodegaStock(productId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('product_bodega_stock')
    .select('bodega, stock')
    .eq('product_id', productId)
    .order('bodega')
  if (error) return []
  return data
}

async function recomputeProductStockTotal(productId: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('product_bodega_stock')
    .select('stock')
    .eq('product_id', productId)
  const total = (data || []).reduce((sum, r) => sum + r.stock, 0)
  await supabase.from('products').update({ stock: total }).eq('id', productId)
  return total
}

export async function replaceProductBodegaStock(productId: string, entries: { bodega: string; stock: number }[]) {
  const supabase = await createServerSupabaseClient()

  const { error: delError } = await supabase.from('product_bodega_stock').delete().eq('product_id', productId)
  if (delError) return { error: delError.message }

  const rows = entries.filter(e => e.stock > 0).map(e => ({ product_id: productId, bodega: e.bodega, stock: e.stock }))
  if (rows.length > 0) {
    const { error: insError } = await supabase.from('product_bodega_stock').insert(rows)
    if (insError) return { error: insError.message }
  }

  await recomputeProductStockTotal(productId)
  revalidatePath('/pisos')
  revalidatePath(`/pisos/${productId}`)
  revalidatePath('/inventario')
  revalidatePath('/')
  return { success: true }
}

export async function adjustProductBodegaStock(productId: string, bodega: string, newStock: number) {
  if (newStock < 0) return { error: 'El stock no puede ser negativo' }
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('product_bodega_stock')
    .upsert({ product_id: productId, bodega, stock: newStock }, { onConflict: 'product_id,bodega' })

  if (error) return { error: error.message }

  const total = await recomputeProductStockTotal(productId)
  revalidatePath('/pisos')
  revalidatePath(`/pisos/${productId}`)
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

export async function createProduct(formData: FormData) {
  const supabase = await createServerSupabaseClient()

  // Image is uploaded client-side; we just receive the resulting public URL
  const imageUrl = (formData.get('image_url') as string) || null

  const sqmPerBox = parseFloat(formData.get('sqm_per_box') as string) || null
  const pricePerSqm = parseFloat(formData.get('price_per_sqm') as string) || null
  const pricePerBox = pricePerSqm && sqmPerBox ? parseFloat((pricePerSqm * sqmPerBox).toFixed(2)) : null
  const saleUnit = (formData.get('sale_unit') as string) || 'caja'
  const bodegaEntries = parseBodegaEntries(formData)
  const totalStock = bodegaEntries.reduce((sum, e) => sum + e.stock, 0)

  const { data, error } = await supabase.from('products').insert({
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    material: formData.get('material') as string,
    brand_id: (formData.get('brand_id') as string) || null,
    size_id: (formData.get('size_id') as string) || null,
    sku: (formData.get('sku') as string) || null,
    finish: (formData.get('finish') as string) || null,
    color: (formData.get('color') as string) || null,
    stock: totalStock,
    sale_unit: saleUnit,
    pieces_per_box: parseInt(formData.get('pieces_per_box') as string) || null,
    sqm_per_box: sqmPerBox,
    price_per_sqm: pricePerSqm,
    price_per_box: pricePerBox,
    image_url: imageUrl,
  }).select('id').single()

  if (error) return { error: error.message }

  const rows = bodegaEntries.filter(e => e.stock > 0).map(e => ({ product_id: data.id, bodega: e.bodega, stock: e.stock }))
  if (rows.length > 0) await supabase.from('product_bodega_stock').insert(rows)

  revalidatePath('/pisos')
  revalidatePath('/')
  return { success: true }
}

export async function updateProduct(id: string, formData: FormData) {
  const supabase = await createServerSupabaseClient()

  // Image is uploaded client-side; we receive the URL (new or existing)
  const imageUrl = (formData.get('image_url') as string) || null

  const sqmPerBox = parseFloat(formData.get('sqm_per_box') as string) || null
  const pricePerSqm = parseFloat(formData.get('price_per_sqm') as string) || null
  const pricePerBox = pricePerSqm && sqmPerBox ? parseFloat((pricePerSqm * sqmPerBox).toFixed(2)) : null
  const saleUnit = (formData.get('sale_unit') as string) || 'caja'
  const bodegaEntries = parseBodegaEntries(formData)
  const totalStock = bodegaEntries.reduce((sum, e) => sum + e.stock, 0)

  const { error } = await supabase.from('products').update({
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    material: formData.get('material') as string,
    brand_id: (formData.get('brand_id') as string) || null,
    size_id: (formData.get('size_id') as string) || null,
    sku: (formData.get('sku') as string) || null,
    finish: (formData.get('finish') as string) || null,
    color: (formData.get('color') as string) || null,
    stock: totalStock,
    sale_unit: saleUnit,
    pieces_per_box: parseInt(formData.get('pieces_per_box') as string) || null,
    sqm_per_box: sqmPerBox,
    price_per_sqm: pricePerSqm,
    price_per_box: pricePerBox,
    image_url: imageUrl,
  }).eq('id', id)

  if (error) return { error: error.message }

  await replaceProductBodegaStock(id, bodegaEntries)

  revalidatePath('/pisos')
  revalidatePath(`/pisos/${id}`)
  revalidatePath('/')
  return { success: true }
}

export async function updateProductsPriceBulk(
  updates: { id: string; price_per_sqm: number; sqm_per_box: number | null }[]
) {
  const supabase = await createServerSupabaseClient()

  const results = await Promise.all(
    updates.map(({ id, price_per_sqm, sqm_per_box }) => {
      const price_per_box = sqm_per_box ? parseFloat((price_per_sqm * sqm_per_box).toFixed(2)) : null
      return supabase.from('products').update({ price_per_sqm, price_per_box }).eq('id', id)
    })
  )

  const failed = results.filter(r => r.error)
  if (failed.length > 0) return { error: `Fallaron ${failed.length} de ${updates.length} actualizaciones` }

  revalidatePath('/pisos')
  revalidatePath('/inventario')
  revalidatePath('/')
  return { success: true }
}

export async function deleteProduct(id: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pisos')
  revalidatePath('/')
  return { success: true }
}
