'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
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

export async function createAccessory(formData: FormData) {
  const supabase = await createServerSupabaseClient()

  // Image is uploaded client-side; we just receive the resulting public URL
  const imageUrl = (formData.get('image_url') as string) || null

  const { error } = await supabase.from('accessories').insert({
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    category: formData.get('category') as string,
    brand: (formData.get('brand') as string) || null,
    weight: (formData.get('weight') as string) || null,
    color: (formData.get('color') as string) || null,
    stock: parseInt(formData.get('stock') as string) || 0,
    price: parseFloat(formData.get('price') as string) || null,
    image_url: imageUrl,
  })

  if (error) return { error: error.message }
  revalidatePath('/complementos')
  revalidatePath('/')
  return { success: true }
}

export async function updateAccessory(id: string, formData: FormData) {
  const supabase = await createServerSupabaseClient()

  const imageUrl = (formData.get('image_url') as string) || null

  const { error } = await supabase.from('accessories').update({
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    category: formData.get('category') as string,
    brand: (formData.get('brand') as string) || null,
    weight: (formData.get('weight') as string) || null,
    color: (formData.get('color') as string) || null,
    stock: parseInt(formData.get('stock') as string) || 0,
    price: parseFloat(formData.get('price') as string) || null,
    image_url: imageUrl || undefined,
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/complementos')
  revalidatePath(`/complementos/${id}/editar`)
  revalidatePath('/')
  return { success: true }
}

export async function updateAccessoryStock(id: string, stock: number) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('accessories').update({ stock }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/complementos')
  revalidatePath('/inventario')
  revalidatePath('/')
  return { success: true }
}

export async function deleteAccessory(id: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('accessories').update({ is_active: false }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/complementos')
  revalidatePath('/')
  return { success: true }
}
