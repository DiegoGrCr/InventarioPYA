'use server'

import { createAdminSupabaseClient } from '@/lib/supabase/adminClient'
import { createAdminSession, destroyAdminSession, verifyPassword } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function loginAdmin(formData: FormData) {
  const username = (formData.get('username') as string)?.trim()
  const password = (formData.get('password') as string) || ''

  if (!username || !password) return { error: 'Completa usuario y contraseña' }

  // La tabla admins no es legible con la key pública (a proposito — ver el
  // arreglo de seguridad de RLS), así que este es de los pocos lugares del
  // sitio que sí necesita la key de servicio SIN pasar por requireAdmin()
  // primero: es justo el paso que decide si alguien se vuelve admin.
  const supabase = createAdminSupabaseClient()
  const { data: admin } = await supabase
    .from('admins')
    .select('username, password_hash')
    .eq('username', username)
    .single()

  if (!admin || !verifyPassword(password, admin.password_hash)) {
    return { error: 'Usuario o contraseña incorrectos' }
  }

  await createAdminSession(admin.username)
  revalidatePath('/')
  return { success: true }
}

export async function logoutAdmin() {
  await destroyAdminSession()
  revalidatePath('/')
  return { success: true }
}
