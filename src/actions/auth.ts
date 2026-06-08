'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSession, destroyAdminSession, verifyPassword } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function loginAdmin(formData: FormData) {
  const username = (formData.get('username') as string)?.trim()
  const password = (formData.get('password') as string) || ''

  if (!username || !password) return { error: 'Completa usuario y contraseña' }

  const supabase = await createServerSupabaseClient()
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
