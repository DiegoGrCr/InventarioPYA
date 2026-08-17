import { sheets_v4 } from 'googleapis'
import { createPlainSupabaseClient } from './supabase/plainClient'
import type { BodegaConfig } from './sheetSync'
import {
  listTabs, batchGetTabValues, batchWriteCells, batchClearTabs,
  applyStructuralRequests, createMissingTabs, buildAccessoryProtectionRequests,
  buildAccessoryHideColumnsRequest, buildFreezeHeaderRequest, buildAccessoryZeroStockHighlightRequest,
  buildAccessoryRepeatableStyleRequests, cellRange, rowRangeAcc,
  COL_ACC, HEADERS_ACC, ACCESSORY_TAB_NAME, TabInfo, CellValue,
} from './googleSheets'

// -------- Datos maestros (BDD → qué DEBERÍA haber en la pestaña "Adhesivos" de cada bodega) --------

interface AccessoryMasterRow {
  accessoryId: string
  name: string
  category: string
  precio: number | null
  stock: number
}

async function fetchAccessoryMasterData(supabase: ReturnType<typeof createPlainSupabaseClient>, bodegas: string[]): Promise<Map<string, AccessoryMasterRow[]>> {
  const result = new Map<string, AccessoryMasterRow[]>()
  bodegas.forEach(b => result.set(b, []))
  if (bodegas.length === 0) return result

  const { data, error } = await supabase
    .from('accessory_bodega_stock')
    .select('bodega, stock, accessory:accessories!inner(id, name, category, price, is_active)')
    .in('bodega', bodegas)
    .eq('accessory.is_active', true)

  if (error) throw new Error(`Error leyendo accessory_bodega_stock: ${error.message}`)

  interface AccessoryJoin { id: string; name: string; category: string; price: number | null }

  ;(data || []).forEach(row => {
    const a = row.accessory as unknown as AccessoryJoin | null
    if (!a) return
    const list = result.get(row.bodega)
    if (!list) return
    list.push({ accessoryId: a.id, name: a.name, category: a.category, precio: a.price, stock: row.stock })
  })
  return result
}

function sortAccessoryRows(rows: AccessoryMasterRow[]): AccessoryMasterRow[] {
  return [...rows].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
}

// -------- Fase A: leer la pestaña y detectar qué cambió del lado del personal --------
// Mismas reglas de valor inválido ya probadas para Pisos (ver sheetSync.ts).

interface ParsedAccessoryRow {
  accessoryId: string
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

function parseAccessoryTabRows(rows: CellValue[][]): ParsedAccessoryRow[] {
  const out: ParsedAccessoryRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const accessoryId = cellIdText(r[COL_ACC.ACCESSORY_ID])
    if (!accessoryId) continue

    const priceText = cellIdText(r[COL_ACC.PRECIO])
    const priceNum = cellNum(r[COL_ACC.PRECIO])
    const priceInvalid = (priceText !== '' && priceNum === null) || (priceNum !== null && priceNum < 0)

    const stockText = cellIdText(r[COL_ACC.CANTIDAD])
    const stockNum = cellNum(r[COL_ACC.CANTIDAD])
    const stockInvalid = (stockText !== '' && stockNum === null) || (stockNum !== null && stockNum < 0)

    out.push({
      accessoryId,
      rowIndex1: i + 1,
      name: cellRaw(r[COL_ACC.DESCRIPCION]),
      price: priceNum,
      priceInvalid,
      stock: stockInvalid ? 0 : (stockNum ?? 0),
      stockInvalid,
      trackedName: cellRaw(r[COL_ACC.LAST_SYNCED_NAME]),
      trackedPrice: cellNum(r[COL_ACC.LAST_SYNCED_PRICE]),
    })
  }
  return out
}

interface AccessoryBodegaSheetState {
  config: BodegaConfig
  tab: TabInfo | null
  rows: ParsedAccessoryRow[]
}

interface AccessoryPullMapEntry { name?: string; price?: number | null }

interface AccessoryPullOutcome {
  pullMap: Map<string, AccessoryPullMapEntry>
  stockPushes: { accessoryId: string; bodega: string; stock: number }[]
  conflicts: { accessoryId: string; field: 'name' | 'price' }[]
  sheetStates: AccessoryBodegaSheetState[]
}

async function pullAccessoryPhase(
  sheets: sheets_v4.Sheets,
  configs: BodegaConfig[],
  masterBefore: Map<string, AccessoryMasterRow[]>,
  invocationId: string,
): Promise<AccessoryPullOutcome> {
  const pullMap = new Map<string, AccessoryPullMapEntry>()
  const stockPushes: AccessoryPullOutcome['stockPushes'] = []
  const conflicts: AccessoryPullOutcome['conflicts'] = []
  const sheetStates: AccessoryBodegaSheetState[] = []

  for (const config of configs) {
    const validIds = new Set((masterBefore.get(config.bodega) || []).map(r => r.accessoryId))

    console.log(`[sync-acc ${invocationId}] listTabs bodega=${config.bodega} spreadsheetId=${config.spreadsheetId}`)
    const tabs = await listTabs(sheets, config.spreadsheetId)
    const tab = tabs.find(t => t.title === ACCESSORY_TAB_NAME) || null

    let rows: ParsedAccessoryRow[] = []
    if (tab) {
      const values = await batchGetTabValues(sheets, config.spreadsheetId, [ACCESSORY_TAB_NAME])
      rows = parseAccessoryTabRows(values.get(ACCESSORY_TAB_NAME) || [])
      for (const row of rows) {
        if (!validIds.has(row.accessoryId)) continue

        if (!row.stockInvalid) {
          stockPushes.push({ accessoryId: row.accessoryId, bodega: config.bodega, stock: row.stock })
        }

        if (row.name && row.name !== row.trackedName) {
          const existing = pullMap.get(row.accessoryId)
          if (existing?.name !== undefined && existing.name !== row.name) conflicts.push({ accessoryId: row.accessoryId, field: 'name' })
          pullMap.set(row.accessoryId, { ...existing, name: row.name })
        }
        if (!row.priceInvalid && row.price !== row.trackedPrice) {
          const existing = pullMap.get(row.accessoryId)
          if (existing?.price !== undefined && existing.price !== row.price) conflicts.push({ accessoryId: row.accessoryId, field: 'price' })
          pullMap.set(row.accessoryId, { ...existing, price: row.price })
        }
      }
    }
    sheetStates.push({ config, tab, rows })
  }

  return { pullMap, stockPushes, conflicts, sheetStates }
}

async function recomputeAccessoryStockTotal(supabase: ReturnType<typeof createPlainSupabaseClient>, accessoryId: string) {
  const { data } = await supabase.from('accessory_bodega_stock').select('stock').eq('accessory_id', accessoryId)
  const total = (data || []).reduce((sum: number, r: { stock: number }) => sum + r.stock, 0)
  await supabase.from('accessories').update({ stock: total }).eq('id', accessoryId)
}

async function applyAccessoryPulls(
  supabase: ReturnType<typeof createPlainSupabaseClient>,
  pullMap: AccessoryPullOutcome['pullMap'],
  stockPushes: AccessoryPullOutcome['stockPushes'],
) {
  await Promise.all(Array.from(pullMap.entries()).map(async ([id, changes]) => {
    const patch: Record<string, unknown> = {}
    if (changes.name !== undefined) patch.name = changes.name
    if (changes.price !== undefined) patch.price = changes.price
    if (Object.keys(patch).length > 0) await supabase.from('accessories').update(patch).eq('id', id)
  }))

  await Promise.all(stockPushes.map(s =>
    supabase.from('accessory_bodega_stock').upsert({ accessory_id: s.accessoryId, bodega: s.bodega, stock: s.stock }, { onConflict: 'accessory_id,bodega' })
  ))

  const affected = new Set<string>([...pullMap.keys(), ...stockPushes.map(s => s.accessoryId)])
  await Promise.all(Array.from(affected).map(id => recomputeAccessoryStockTotal(supabase, id)))
}

// -------- Fase B: reconciliar la pestaña contra los datos ya actualizados --------

function buildAccessoryTabContentValues(rows: AccessoryMasterRow[]): (string | number)[][] {
  return sortAccessoryRows(rows).map(it => [
    it.category === 'adhesivo' ? 'Adhesivo' : 'Boquilla', it.name, it.stock, it.precio ?? '',
    it.accessoryId, it.name, it.precio ?? '',
  ])
}

export interface AccessoryBodegaResult { bodega: string; rebuilt: boolean; cellsWritten: number; error?: string; needsReview?: boolean }

async function reconcileAccessoryBodega(
  sheets: sheets_v4.Sheets,
  state: AccessoryBodegaSheetState,
  freshRows: AccessoryMasterRow[],
  allowStructural: boolean,
  invocationId: string,
): Promise<AccessoryBodegaResult> {
  const { config, tab, rows: actualRows } = state
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!

  const isNewTab = !tab
  let sheetId = tab?.sheetId

  if (isNewTab) {
    if (!allowStructural) return { bodega: config.bodega, rebuilt: false, cellsWritten: 0, needsReview: true }
    const created = await createMissingTabs(sheets, config.spreadsheetId, [ACCESSORY_TAB_NAME])
    sheetId = created.get(ACCESSORY_TAB_NAME)
    if (sheetId == null) return { bodega: config.bodega, rebuilt: false, cellsWritten: 0, error: 'No se pudo crear la pestaña Adhesivos' }
  }

  const desiredIds = new Set(freshRows.map(r => r.accessoryId))
  const actualIds = new Set(actualRows.map(r => r.accessoryId))
  const structurallyDifferent = isNewTab || desiredIds.size !== actualIds.size || [...desiredIds].some(id => !actualIds.has(id))

  if (structurallyDifferent && !allowStructural) {
    return { bodega: config.bodega, rebuilt: false, cellsWritten: 0, needsReview: true }
  }

  const structural: sheets_v4.Schema$Request[] = []
  const writes: { range: string; values: (string | number)[][] }[] = []
  const toClear: string[] = []
  let rebuilt = false

  if (isNewTab) {
    structural.push(...buildAccessoryProtectionRequests(sheetId!, serviceAccountEmail))
    structural.push(buildAccessoryHideColumnsRequest(sheetId!))
    structural.push(buildFreezeHeaderRequest(sheetId!))
    structural.push(buildAccessoryZeroStockHighlightRequest(sheetId!))
    writes.push({ range: rowRangeAcc(ACCESSORY_TAB_NAME, 1, 1), values: [HEADERS_ACC] })
  }
  structural.push(...buildAccessoryRepeatableStyleRequests(sheetId!))

  if (structurallyDifferent) {
    if (!isNewTab) toClear.push(ACCESSORY_TAB_NAME)
    const values = buildAccessoryTabContentValues(freshRows)
    if (values.length > 0) writes.push({ range: rowRangeAcc(ACCESSORY_TAB_NAME, 2, 1 + values.length), values })
    rebuilt = true
  } else {
    const byId = new Map(freshRows.map(r => [r.accessoryId, r]))
    for (const row of actualRows) {
      const authoritative = byId.get(row.accessoryId)
      if (!authoritative) continue
      if (row.name !== authoritative.name) {
        writes.push({ range: cellRange(ACCESSORY_TAB_NAME, COL_ACC.DESCRIPCION, row.rowIndex1), values: [[authoritative.name]] })
      }
      if (row.trackedName !== authoritative.name) {
        writes.push({ range: cellRange(ACCESSORY_TAB_NAME, COL_ACC.LAST_SYNCED_NAME, row.rowIndex1), values: [[authoritative.name]] })
      }
      if (row.price !== authoritative.precio) {
        writes.push({ range: cellRange(ACCESSORY_TAB_NAME, COL_ACC.PRECIO, row.rowIndex1), values: [[authoritative.precio ?? '']] })
      }
      if (row.trackedPrice !== authoritative.precio) {
        writes.push({ range: cellRange(ACCESSORY_TAB_NAME, COL_ACC.LAST_SYNCED_PRICE, row.rowIndex1), values: [[authoritative.precio ?? '']] })
      }
      if (row.stock !== authoritative.stock) {
        writes.push({ range: cellRange(ACCESSORY_TAB_NAME, COL_ACC.CANTIDAD, row.rowIndex1), values: [[authoritative.stock]] })
      }
    }
  }

  console.log(`[sync-acc ${invocationId}] write bodega=${config.bodega} spreadsheetId=${config.spreadsheetId} rebuilt=${rebuilt} writes=${writes.length}`)
  await batchClearTabs(sheets, config.spreadsheetId, toClear)
  await applyStructuralRequests(sheets, config.spreadsheetId, structural)
  await batchWriteCells(sheets, config.spreadsheetId, writes)

  return { bodega: config.bodega, rebuilt, cellsWritten: writes.length }
}

// Mismo criterio de seguridad que assertBodegaMembership en sheetSync.ts: antes
// de escribir, se vuelve a consultar accessory_bodega_stock desde cero para
// esta bodega específica y se confirma que coincide con lo que se va a escribir.
async function assertAccessoryBodegaMembership(supabase: ReturnType<typeof createPlainSupabaseClient>, bodega: string, rows: AccessoryMasterRow[]) {
  const { data, error } = await supabase.from('accessory_bodega_stock').select('accessory_id').eq('bodega', bodega)
  if (error) throw new Error(`Verificación de seguridad falló (adhesivos, ${bodega}): ${error.message}`)
  const realIds = new Set((data || []).map(r => r.accessory_id))
  const extra = rows.map(r => r.accessoryId).filter(id => !realIds.has(id))
  if (extra.length > 0) {
    throw new Error(`Verificación de seguridad falló (adhesivos, ${bodega}): ${extra.length} adhesivo(s) no pertenecen realmente a esta bodega (ej. ${extra[0]}) — se aborta.`)
  }
}

export async function syncAccessoriesForBodegas(
  sheets: sheets_v4.Sheets,
  supabase: ReturnType<typeof createPlainSupabaseClient>,
  configs: BodegaConfig[],
  allowStructural: boolean,
  invocationId: string,
): Promise<AccessoryBodegaResult[]> {
  const bodegaNames = configs.map(c => c.bodega)

  const masterBeforePulls = await fetchAccessoryMasterData(supabase, bodegaNames)
  const { pullMap, stockPushes, sheetStates } = await pullAccessoryPhase(sheets, configs, masterBeforePulls, invocationId)

  await applyAccessoryPulls(supabase, pullMap, stockPushes)

  const freshMaster = await fetchAccessoryMasterData(supabase, bodegaNames)

  const results: AccessoryBodegaResult[] = []
  for (const state of sheetStates) {
    try {
      const rowsForBodega = freshMaster.get(state.config.bodega) || []
      await assertAccessoryBodegaMembership(supabase, state.config.bodega, rowsForBodega)
      results.push(await reconcileAccessoryBodega(sheets, state, rowsForBodega, allowStructural, invocationId))
    } catch (err) {
      results.push({ bodega: state.config.bodega, rebuilt: false, cellsWritten: 0, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return results
}
