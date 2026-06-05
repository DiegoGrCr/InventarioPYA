'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getBrands() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.from('brands').select('*').order('name')
  if (error) throw error
  return data || []
}

export async function createBrand(name: string, isImported: boolean = false) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('brands').insert({ name, is_imported: isImported })
  if (error) return { error: error.message }
  revalidatePath('/marcas')
  return { success: true }
}

export async function deleteBrand(id: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('brands').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/marcas')
  return { success: true }
}

export async function getSizes() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.from('sizes').select('*')
  if (error) throw error
  return (data || []).sort((a, b) => (a.width * a.height) - (b.width * b.height))
}

export async function createSize(width: number, height: number) {
  const supabase = await createServerSupabaseClient()
  const label = `${width}x${height}`
  const { error } = await supabase.from('sizes').insert({ width, height, label })
  if (error) return { error: error.message }
  revalidatePath('/medidas')
  return { success: true }
}

export async function deleteSize(id: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('sizes').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/medidas')
  return { success: true }
}
