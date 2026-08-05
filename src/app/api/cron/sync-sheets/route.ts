import { NextRequest, NextResponse } from 'next/server'
import { syncAllBodegas } from '@/lib/sheetSync'

// googleapis firma JWT con Node crypto — no corre en el runtime Edge.
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const summary = await syncAllBodegas()
    return NextResponse.json(summary)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error desconocido' }, { status: 500 })
  }
}
