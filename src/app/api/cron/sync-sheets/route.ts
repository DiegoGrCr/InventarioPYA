import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { syncAllBodegas } from '@/lib/sheetSync'

// googleapis firma JWT con Node crypto — no corre en el runtime Edge.
export const runtime = 'nodejs'
export const maxDuration = 60
// CRÍTICO: sin esto, Next.js puede cachear las llamadas fetch() que googleapis
// hace por debajo hacia la API de Sheets (ya que esta ruta nunca usa cookies()/
// headers() de next/headers, que son las que normalmente activan el modo
// dinámico) — eso causaba que cada corrida en producción leyera una copia
// vieja de la hoja y reconstruyera pestañas en un ciclo sin fin, aunque
// localmente (sin el runtime de Next.js) siempre funcionara bien.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

function isValidCronSecret(auth: string | null): boolean {
  if (!process.env.CRON_SECRET || !auth) return false
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`)
  const actual = Buffer.from(auth)
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

export async function GET(req: NextRequest) {
  if (!isValidCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // "structural=0" desactiva crear pestañas nuevas / reconstruir pestañas
  // completas — encendido por default. La causa real de que esto escribiera
  // contenido de una bodega en el archivo de otra era GOOGLE_SHEET_ID_LA_PLAYITA
  // mal capturada en Vercel (apuntaba al archivo de Arroyo) — no un bug de
  // concurrencia. Ya corregido y verificado con una alta real de producto.
  const allowStructural = req.nextUrl.searchParams.get('structural') !== '0'
  const invocationId = crypto.randomUUID()

  try {
    const summary = await syncAllBodegas({ allowStructural, invocationId })
    return NextResponse.json({ invocationId, ...summary })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error desconocido' }, { status: 500 })
  }
}
