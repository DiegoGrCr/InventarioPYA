import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'

// Cliente sin dependencia de cookies/next headers, para contextos sin request
// HTTP con sesión (ej. la ruta de cron de sincronización con Google Sheets).
// Usa la secret key: el cron ya está protegido por CRON_SECRET (ver
// api/cron/sync-sheets/route.ts), y necesita escribir stock/precio sin
// restricción de RLS — igual que las políticas ya no permiten escritura
// pública con la key publicable.
export function createPlainSupabaseClient() {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}
