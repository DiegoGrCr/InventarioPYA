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

export async function createProduct(formData: FormData) {
  const supabase = await createServerSupabaseClient()

  // Image is uploaded client-side; we just receive the resulting public URL
  const imageUrl = (formData.get('image_url') as string) || null

  const sqmPerBox = parseFloat(formData.get('sqm_per_box') as string) || null
  const pricePerSqm = parseFloat(formData.get('price_per_sqm') as string) || null
  const pricePerBox = pricePerSqm && sqmPerBox ? parseFloat((pricePerSqm * sqmPerBox).toFixed(2)) : null

  const { error } = await supabase.from('products').insert({
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    material: formData.get('material') as string,
    brand_id: (formData.get('brand_id') as string) || null,
    size_id: (formData.get('size_id') as string) || null,
    sku: (formData.get('sku') as string) || null,
    finish: (formData.get('finish') as string) || null,
    color: (formData.get('color') as string) || null,
    stock: parseInt(formData.get('stock') as string) || 0,
    pieces_per_box: parseInt(formData.get('pieces_per_box') as string) || null,
    sqm_per_box: sqmPerBox,
    price_per_sqm: pricePerSqm,
    price_per_box: pricePerBox,
    image_url: imageUrl,
  })

  if (error) return { error: error.message }
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

  const { error } = await supabase.from('products').update({
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    material: formData.get('material') as string,
    brand_id: (formData.get('brand_id') as string) || null,
    size_id: (formData.get('size_id') as string) || null,
    sku: (formData.get('sku') as string) || null,
    finish: (formData.get('finish') as string) || null,
    color: (formData.get('color') as string) || null,
    stock: parseInt(formData.get('stock') as string) || 0,
    pieces_per_box: parseInt(formData.get('pieces_per_box') as string) || null,
    sqm_per_box: sqmPerBox,
    price_per_sqm: pricePerSqm,
    price_per_box: pricePerBox,
    image_url: imageUrl,
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/pisos')
  revalidatePath(`/pisos/${id}`)
  revalidatePath('/')
  return { success: true }
}

export async function updateProductStock(id: string, stock: number) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('products').update({ stock }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pisos')
  revalidatePath(`/pisos/${id}`)
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
