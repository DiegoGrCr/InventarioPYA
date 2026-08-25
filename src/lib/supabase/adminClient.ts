import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'

// Cliente con la secret key: ignora RLS por completo, así que solo se usa
// para ESCRITURAS del lado servidor, y solo después de haber verificado
// isAdminSession() (Server Actions) o el CRON_SECRET (el cron de sync) — este
// cliente en sí no verifica nada, confía en que quien lo llama ya lo hizo.
// Nunca se debe importar desde un componente cliente ni exponer esta key con
// el prefijo NEXT_PUBLIC_.
export function createAdminSupabaseClient() {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}
