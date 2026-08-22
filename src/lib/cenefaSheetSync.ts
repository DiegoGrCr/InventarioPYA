import { sheets_v4 } from 'googleapis'
import { createPlainSupabaseClient } from './supabase/plainClient'
import type { BodegaConfig } from './sheetSync'
import {
  listTabs, batchGetTabValues, batchWriteCells, batchClearTabs,
  applyStructuralRequests, createMissingTabs, buildCenefaProtectionRequests,
  buildCenefaHideColumnsRequest, buildFreezeHeaderRequest, buildCenefaZeroStockHighlightRequest,
  buildCenefaRepeatableStyleRequests, cellRange, rowRangeCenefa,
  getSheetProtectionState, buildClearProtectionsAndFormatsRequests,
  COL_CENEFA, HEADERS_CENEFA, CENEFA_TAB_NAME, TabInfo, CellValue,
} from './googleSheets'

// -------- Datos maestros (BDD → qué DEBERÍA haber en la pestaña "Cenefas" de cada bodega) --------

interface CenefaMasterRow {
  cenefaId: string
  name: string
  brand: string
  formato: string
  sku: string | null
  piezas: number | null
  m2: number | null
  precio: number | null
  stock: number
}

async function fetchCenefaMasterData(supabase: ReturnType<typeof createPlainSupabaseClient>, bodegas: string[]): Promise<Map<string, CenefaMasterRow[]>> {
  const result = new Map<string, CenefaMasterRow[]>()
  bodegas.forEach(b => result.set(b, []))
  if (bodegas.length === 0) return result

  const { data, error } = await supabase
    .from('cenefa_bodega_stock')
    .select('bodega, stock, cenefa:cenefas!inner(id, name, sku, price_per_sqm, pieces_per_box, sqm_per_box, sale_unit, is_active, brand:brands(name), size:sizes(label))')
    .in('bodega', bodegas)
    .eq('cenefa.is_active', true)

  if (error) throw new Error(`Error leyendo cenefa_bodega_stock: ${error.message}`)

  interface CenefaJoin {
    id: string; name: string; sku: string | null; price_per_sqm: number | null; pieces_per_box: number | null
    sqm_per_box: number | null; brand: { name: string } | null; size: { label: string } | null
  }

  ;(data || []).forEach(row => {
    const c = row.cenefa as unknown as CenefaJoin | null
    if (!c) return
    const list = result.get(row.bodega)
    if (!list) return
    list.push({
      cenefaId: c.id, name: c.name, brand: c.brand?.name || '', formato: c.size?.label || '', sku: c.sku,
      piezas: c.pieces_per_box, m2: c.sqm_per_box, precio: c.price_per_sqm, stock: row.stock,
    })
  })
  return result
}

function sortCenefaRows(rows: CenefaMasterRow[]): CenefaMasterRow[] {
  return [...rows].sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name))
}

// -------- Fase A: leer la pestaña y detectar qué cambió del lado del personal --------
// Mismas reglas de valor inválido ya probadas para Pisos/Mallas/Adhesivos.

interface ParsedCenefaRow {
  cenefaId: string
  rowIndex1: number
  name: string
  price: number | null
  priceInvalid: boolean
  stock: number
  stockInvalid: boolean
  trackedName: string
  trackedPrice: number | null
}

function cellRaw(v: CellValue | undefined): string {
  return String(v ?? '')
}

function cellIdText(v: CellValue | undefined): string {
  return cellRaw(v).trim()
}

function cellNum(v: CellValue | undefined): number | null {
  if (typeof v === 'number') return v
  const s = cellIdText(v)
  if (s === '') return null
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

function parseCenefaTabRows(rows: CellValue[][]): ParsedCenefaRow[] {
  const out: ParsedCenefaRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const cenefaId = cellIdText(r[COL_CENEFA.CENEFA_ID])
    if (!cenefaId) continue

    const priceText = cellIdText(r[COL_CENEFA.PRECIO])
    const priceNum = cellNum(r[COL_CENEFA.PRECIO])
    const priceInvalid = (priceText !== '' && priceNum === null) || (priceNum !== null && priceNum < 0)

    const stockText = cellIdText(r[COL_CENEFA.CAJAS_EN_EXISTENCIA])
    const stockNum = cellNum(r[COL_CENEFA.CAJAS_EN_EXISTENCIA])
    const stockInvalid = (stockText !== '' && stockNum === null) || (stockNum !== null && stockNum < 0)

    out.push({
      cenefaId,
      rowIndex1: i + 1,
      name: cellRaw(r[COL_CENEFA.DESCRIPCION]),
      price: priceNum,
      priceInvalid,
      stock: stockInvalid ? 0 : (stockNum ?? 0),
      stockInvalid,
      trackedName: cellRaw(r[COL_CENEFA.LAST_SYNCED_NAME]),
      trackedPrice: cellNum(r[COL_CENEFA.LAST_SYNCED_PRICE]),
    })
  }
  return out
}

interface CenefaBodegaSheetState {
  config: BodegaConfig
  tab: TabInfo | null
  rows: ParsedCenefaRow[]
}

interface CenefaPullMapEntry { name?: string; price?: number | null }

interface CenefaPullOutcome {
  pullMap: Map<string, CenefaPullMapEntry>
  stockPushes: { cenefaId: string; bodega: string; stock: number }[]
  conflicts: { cenefaId: string; field: 'name' | 'price' }[]
  sheetStates: CenefaBodegaSheetState[]
}

async function pullCenefaPhase(
  sheets: sheets_v4.Sheets,
  configs: BodegaConfig[],
  masterBefore: Map<string, CenefaMasterRow[]>,
  invocationId: string,
): Promise<CenefaPullOutcome> {
  const pullMap = new Map<string, CenefaPullMapEntry>()
  const stockPushes: CenefaPullOutcome['stockPushes'] = []
  const conflicts: CenefaPullOutcome['conflicts'] = []
  const sheetStates: CenefaBodegaSheetState[] = []

  for (const config of configs) {
    const validIds = new Set((masterBefore.get(config.bodega) || []).map(r => r.cenefaId))

    console.log(`[sync-cenefa ${invocationId}] listTabs bodega=${config.bodega} spreadsheetId=${config.spreadsheetId}`)
    const tabs = await listTabs(sheets, config.spreadsheetId)
    const tab = tabs.find(t => t.title === CENEFA_TAB_NAME) || null

    let rows: ParsedCenefaRow[] = []
    if (tab) {
      const values = await batchGetTabValues(sheets, config.spreadsheetId, [CENEFA_TAB_NAME])
      rows = parseCenefaTabRows(values.get(CENEFA_TAB_NAME) || [])
      for (const row of rows) {
        if (!validIds.has(row.cenefaId)) continue

        if (!row.stockInvalid) {
          stockPushes.push({ cenefaId: row.cenefaId, bodega: config.bodega, stock: row.stock })
        }

        if (row.name && row.name !== row.trackedName) {
          const existing = pullMap.get(row.cenefaId)
          if (existing?.name !== undefined && existing.name !== row.name) conflicts.push({ cenefaId: row.cenefaId, field: 'name' })
          pullMap.set(row.cenefaId, { ...existing, name: row.name })
        }
        if (!row.priceInvalid && row.price !== row.trackedPrice) {
          const existing = pullMap.get(row.cenefaId)
          if (existing?.price !== undefined && existing.price !== row.price) conflicts.push({ cenefaId: row.cenefaId, field: 'price' })
          pullMap.set(row.cenefaId, { ...existing, price: row.price })
        }
      }
    }
    sheetStates.push({ config, tab, rows })
  }

  return { pullMap, stockPushes, conflicts, sheetStates }
}

async function recomputeCenefaStockTotal(supabase: ReturnType<typeof createPlainSupabaseClient>, cenefaId: string) {
  const { data } = await supabase.from('cenefa_bodega_stock').select('stock').eq('cenefa_id', cenefaId)
  const total = (data || []).reduce((sum: number, r: { stock: number }) => sum + r.stock, 0)
  await supabase.from('cenefas').update({ stock: total }).eq('id', cenefaId)
}

async function applyCenefaPulls(
  supabase: ReturnType<typeof createPlainSupabaseClient>,
  master: Map<string, CenefaMasterRow[]>,
  pullMap: CenefaPullOutcome['pullMap'],
  stockPushes: CenefaPullOutcome['stockPushes'],
) {
  const sqmByCenefa = new Map<string, number | null>()
  master.forEach(rows => rows.forEach(r => { if (!sqmByCenefa.has(r.cenefaId)) sqmByCenefa.set(r.cenefaId, r.m2) }))

  await Promise.all(Array.from(pullMap.entries()).map(async ([id, changes]) => {
    const patch: Record<string, unknown> = {}
    if (changes.name !== undefined) patch.name = changes.name
    if (changes.price !== undefined) {
      patch.price_per_sqm = changes.price
      const sqm = sqmByCenefa.get(id)
      patch.price_per_box = (changes.price != null && sqm) ? parseFloat((changes.price * sqm).toFixed(2)) : null
    }
    if (Object.keys(patch).length > 0) await supabase.from('cenefas').update(patch).eq('id', id)
  }))

  await Promise.all(stockPushes.map(s =>
    supabase.from('cenefa_bodega_stock').upsert({ cenefa_id: s.cenefaId, bodega: s.bodega, stock: s.stock }, { onConflict: 'cenefa_id,bodega' })
  ))

  const affected = new Set<string>([...pullMap.keys(), ...stockPushes.map(s => s.cenefaId)])
  await Promise.all(Array.from(affected).map(id => recomputeCenefaStockTotal(supabase, id)))
}

// -------- Fase B: reconciliar la pestaña contra los datos ya actualizados --------

function buildCenefaTabContentValues(rows: CenefaMasterRow[]): (string | number)[][] {
  return sortCenefaRows(rows).map(it => [
    it.brand || 'Sin marca', it.formato || '', it.sku ?? '', it.name, it.piezas ?? '', it.m2 ?? '', it.stock, it.precio ?? '',
    it.cenefaId, it.name, it.precio ?? '',
  ])
}

export interface CenefaBodegaResult { bodega: string; rebuilt: boolean; cellsWritten: number; error?: string; needsReview?: boolean }

async function reconcileCenefaBodega(
  sheets: sheets_v4.Sheets,
  state: CenefaBodegaSheetState,
  freshRows: CenefaMasterRow[],
  allowStructural: boolean,
  invocationId: string,
): Promise<CenefaBodegaResult> {
  const { config, tab, rows: actualRows } = state
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!

  const isNewTab = !tab
  let sheetId = tab?.sheetId

  if (isNewTab) {
    if (!allowStructural) return { bodega: config.bodega, rebuilt: false, cellsWritten: 0, needsReview: true }
    const created = await createMissingTabs(sheets, config.spreadsheetId, [CENEFA_TAB_NAME])
    sheetId = created.get(CENEFA_TAB_NAME)
    if (sheetId == null) return { bodega: config.bodega, rebuilt: false, cellsWritten: 0, error: 'No se pudo crear la pestaña Cenefas' }
  }

  const desiredIds = new Set(freshRows.map(r => r.cenefaId))
  const actualIds = new Set(actualRows.map(r => r.cenefaId))
  const structurallyDifferent = isNewTab || desiredIds.size !== actualIds.size || [...desiredIds].some(id => !actualIds.has(id))

  if (structurallyDifferent && !allowStructural) {
    return { bodega: config.bodega, rebuilt: false, cellsWritten: 0, needsReview: true }
  }

  const structural: sheets_v4.Schema$Request[] = []
  const writes: { range: string; values: (string | number)[][] }[] = []
  const toClear: string[] = []
  let rebuilt = false

  if (isNewTab || structurallyDifferent) {
    if (!isNewTab) {
      const { protectedRangeIds, conditionalFormatCount } = await getSheetProtectionState(sheets, config.spreadsheetId, sheetId!)
      structural.push(...buildClearProtectionsAndFormatsRequests(sheetId!, protectedRangeIds, conditionalFormatCount))
    }
    structural.push(...buildCenefaProtectionRequests(sheetId!, serviceAccountEmail))
    structural.push(buildFreezeHeaderRequest(sheetId!))
    structural.push(buildCenefaZeroStockHighlightRequest(sheetId!))
    writes.push({ range: rowRangeCenefa(CENEFA_TAB_NAME, 1, 1), values: [HEADERS_CENEFA] })
  }
  structural.push(...buildCenefaHideColumnsRequest(sheetId!))
  structural.push(...buildCenefaRepeatableStyleRequests(sheetId!))

  if (structurallyDifferent) {
    if (!isNewTab) toClear.push(CENEFA_TAB_NAME)
    const values = buildCenefaTabContentValues(freshRows)
    if (values.length > 0) writes.push({ range: rowRangeCenefa(CENEFA_TAB_NAME, 2, 1 + values.length), values })
    rebuilt = true
  } else {
    const byId = new Map(freshRows.map(r => [r.cenefaId, r]))
    for (const row of actualRows) {
      const authoritative = byId.get(row.cenefaId)
      if (!authoritative) continue
      if (row.name !== authoritative.name) {
        writes.push({ range: cellRange(CENEFA_TAB_NAME, COL_CENEFA.DESCRIPCION, row.rowIndex1), values: [[authoritative.name]] })
      }
      if (row.trackedName !== authoritative.name) {
        writes.push({ range: cellRange(CENEFA_TAB_NAME, COL_CENEFA.LAST_SYNCED_NAME, row.rowIndex1), values: [[authoritative.name]] })
      }
      if (row.price !== authoritative.precio) {
        writes.push({ range: cellRange(CENEFA_TAB_NAME, COL_CENEFA.PRECIO, row.rowIndex1), values: [[authoritative.precio ?? '']] })
      }
      if (row.trackedPrice !== authoritative.precio) {
        writes.push({ range: cellRange(CENEFA_TAB_NAME, COL_CENEFA.LAST_SYNCED_PRICE, row.rowIndex1), values: [[authoritative.precio ?? '']] })
      }
      if (row.stock !== authoritative.stock) {
        writes.push({ range: cellRange(CENEFA_TAB_NAME, COL_CENEFA.CAJAS_EN_EXISTENCIA, row.rowIndex1), values: [[authoritative.stock]] })
      }
    }
  }

  console.log(`[sync-cenefa ${invocationId}] write bodega=${config.bodega} spreadsheetId=${config.spreadsheetId} rebuilt=${rebuilt} writes=${writes.length}`)
  await batchClearTabs(sheets, config.spreadsheetId, toClear)
  await applyStructuralRequests(sheets, config.spreadsheetId, structural)
  await batchWriteCells(sheets, config.spreadsheetId, writes)

  return { bodega: config.bodega, rebuilt, cellsWritten: writes.length }
}

// Mismo criterio de seguridad que assertBodegaMembership en sheetSync.ts: antes
// de escribir, se vuelve a consultar cenefa_bodega_stock desde cero para esta
// bodega específica y se confirma que coincide con lo que se va a escribir.
async function assertCenefaBodegaMembership(supabase: ReturnType<typeof createPlainSupabaseClient>, bodega: string, rows: CenefaMasterRow[]) {
  const { data, error } = await supabase.from('cenefa_bodega_stock').select('cenefa_id').eq('bodega', bodega)
  if (error) throw new Error(`Verificación de seguridad falló (cenefas, ${bodega}): ${error.message}`)
  const realIds = new Set((data || []).map(r => r.cenefa_id))
  const extra = rows.map(r => r.cenefaId).filter(id => !realIds.has(id))
  if (extra.length > 0) {
    throw new Error(`Verificación de seguridad falló (cenefas, ${bodega}): ${extra.length} cenefa(s) no pertenecen realmente a esta bodega (ej. ${extra[0]}) — se aborta.`)
  }
}

export async function syncCenefasForBodegas(
  sheets: sheets_v4.Sheets,
  supabase: ReturnType<typeof createPlainSupabaseClient>,
  configs: BodegaConfig[],
  allowStructural: boolean,
  invocationId: string,
): Promise<CenefaBodegaResult[]> {
  const bodegaNames = configs.map(c => c.bodega)

  const masterBeforePulls = await fetchCenefaMasterData(supabase, bodegaNames)
  const { pullMap, stockPushes, sheetStates } = await pullCenefaPhase(sheets, configs, masterBeforePulls, invocationId)

  await applyCenefaPulls(supabase, masterBeforePulls, pullMap, stockPushes)

  const freshMaster = await fetchCenefaMasterData(supabase, bodegaNames)

  const results: CenefaBodegaResult[] = []
  for (const state of sheetStates) {
    try {
      const rowsForBodega = freshMaster.get(state.config.bodega) || []
      await assertCenefaBodegaMembership(supabase, state.config.bodega, rowsForBodega)
      results.push(await reconcileCenefaBodega(sheets, state, rowsForBodega, allowStructural, invocationId))
    } catch (err) {
      results.push({ bodega: state.config.bodega, rebuilt: false, cellsWritten: 0, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return results
}
