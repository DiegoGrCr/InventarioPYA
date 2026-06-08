'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createBanoProduct(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const imageUrl = (formData.get('image_url') as string) || null
  const bodegas = formData.getAll('bodegas') as string[]

  const { error } = await supabase.from('bano_products').insert({
    name: formData.get('name') as string,
    brand: (formData.get('brand') as string) || null,
    model: (formData.get('model') as string) || null,
    color: (formData.get('color') as string) || null,
    bodegas,
    description: (formData.get('description') as string) || null,
    stock: parseInt(formData.get('stock') as string) || 0,
    price: parseFloat(formData.get('price') as string) || null,
    image_url: imageUrl,
  })

  if (error) return { error: error.message }
  revalidatePath('/banos')
  revalidatePath('/')
  return { success: true }
}

export async function updateBanoProduct(id: string, formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const imageUrl = (formData.get('image_url') as string) || null
  const bodegas = formData.getAll('bodegas') as string[]

  const { error } = await supabase.from('bano_products').update({
    name: formData.get('name') as string,
    brand: (formData.get('brand') as string) || null,
    model: (formData.get('model') as string) || null,
    color: (formData.get('color') as string) || null,
    bodegas,
    description: (formData.get('description') as string) || null,
    stock: parseInt(formData.get('stock') as string) || 0,
    price: parseFloat(formData.get('price') as string) || null,
    image_url: imageUrl || undefined,
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/banos')
  revalidatePath(`/banos/${id}/editar`)
  revalidatePath('/')
  return { success: true }
}

export async function updateBanoStock(id: string, stock: number) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('bano_products').update({ stock }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/banos')
  revalidatePath('/inventario')
  revalidatePath('/')
  return { success: true }
}

export async function deleteBanoProduct(id: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('bano_products').update({ is_active: false }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/banos')
  revalidatePath('/')
  return { success: true }
}
