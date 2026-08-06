import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // "structural=0" desactiva crear pestañas nuevas / reconstruir pestañas
  // completas (para productos o marcas nuevas) — encendido por default;
  // solo se apaga manualmente si hace falta investigar algo con calma.
  const allowStructural = req.nextUrl.searchParams.get('structural') !== '0'

  try {
    const summary = await syncAllBodegas({ allowStructural })
    return NextResponse.json(summary)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error desconocido' }, { status: 500 })
  }
}
