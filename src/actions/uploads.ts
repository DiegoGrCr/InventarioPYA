'use server'

import { createAdminSupabaseClient } from '@/lib/supabase/adminClient'
import { requireAdmin } from '@/lib/auth'

// Antes las 5 formas de producto subían directo del navegador a Supabase
// Storage con la key pública — las políticas del bucket ya no permiten esa
// escritura (ver el arreglo de seguridad de RLS), así que ahora la subida
// pasa por aquí: se verifica admin, se valida el archivo, y se usa la key
// de servicio para escribir en el bucket.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB, coincide con el límite que ya mostraba la UI
const ALLOWED_FOLDERS = ['pisos', 'mallas', 'cenefas', 'banos', 'adhesivos', 'boquillas']

export async function uploadImage(file: File, folder: string): Promise<{ url: string } | { error: string }> {
  const authError = await requireAdmin()
  if (authError) return { error: authError.error }

  if (!ALLOWED_FOLDERS.includes(folder)) return { error: 'Carpeta de imagen inválida' }
  if (!ALLOWED_TYPES.includes(file.type)) return { error: 'Tipo de archivo no permitido. Usa JPG, PNG, WEBP o GIF.' }
  if (file.size > MAX_SIZE) return { error: 'La imagen no puede pesar más de 5MB' }

  const supabase = createAdminSupabaseClient()
  const ext = file.name.split('.').pop()
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage.from('product-images').upload(fileName, file, { upsert: false })
  if (error) return { error: `No se pudo subir la imagen: ${error.message}` }

  const { data } = supabase.storage.from('product-images').getPublicUrl(fileName)
  return { url: data.publicUrl }
}
