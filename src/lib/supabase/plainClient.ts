import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'

// Cliente sin dependencia de cookies/next headers, para contextos sin request
// HTTP con sesión (ej. la ruta de cron de sincronización con Google Sheets).
// Usa la misma clave anon que el resto de la app — las políticas RLS ya son
// abiertas (USING (true)), así que no hace falta una service-role key.
export function createPlainSupabaseClient() {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
