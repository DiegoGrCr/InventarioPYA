import { sheets_v4 } from 'googleapis'
import { createPlainSupabaseClient } from './supabase/plainClient'
import type { BodegaConfig } from './sheetSync'
import { isFullyEditableBodega } from './sheetSync'
import {
  listTabs, batchGetTabValues, batchWriteCells, batchClearTabs,
  applyStructuralRequests, createMissingTabs, buildValvuleriaProtectionRequests,
  buildValvuleriaHideColumnsRequest, buildFreezeHeaderRequest, buildValvuleriaZeroStockHighlightRequest, buildValvuleriaLowStockHighlightRequest,
  buildValvuleriaRepeatableStyleRequests, cellRange, rowRangeValvuleria, colRange,
  getSheetProtectionState, buildClearProtectionsAndFormatsRequests,
  COL_VALVULERIA, HEADERS_VALVULERIA, VALVULERIA_TAB_NAME, TabInfo, CellValue,
} from './googleSheets'

// -------- Datos maestros (BDD → qué DEBERÍA haber en la pestaña "Valvulería" de cada bodega) --------

interface ValvuleriaMasterRow {
  valvuleriaId: string
  name: string
  brand: string | null
  sku: string | null
  precio: number | null
  stock: number
  imageUrl: string | null
  comments: string | null
}

async function fetchValvuleriaMasterData(supabase: ReturnType<typeof createPlainSupabaseClient>, bodegas: string[]): Promise<Map<string, ValvuleriaMasterRow[]>> {
  const result = new Map<string, ValvuleriaMasterRow[]>()
  bodegas.forEach(b => result.set(b, []))
  if (bodegas.length === 0) return result

  // A diferencia de Mallas/Cenefas, "brand" aquí es texto libre en la propia
  // tabla (igual que Adhesivos) — no hay join a `brands`.
  const { data, error } = await supabase
    .from('valvuleria_bodega_stock')
    .select('bodega, stock, valvuleria:valvuleria!inner(id, name, sku, price, is_active, image_url, brand, comments)')
    .in('bodega', bodegas)
    .eq('valvuleria.is_active', true)

  if (error) throw new Error(`Error leyendo valvuleria_bodega_stock: ${error.message}`)

  interface ValvuleriaJoin { id: string; name: string; sku: string | null; price: number | null; image_url: string | null; brand: string | null; comments: string | null }

  ;(data || []).forEach(row => {
    const v = row.valvuleria as unknown as ValvuleriaJoin | null
    if (!v) return
    const list = result.get(row.bodega)
    if (!list) return
    list.push({ valvuleriaId: v.id, name: v.name, brand: v.brand, sku: v.sku, precio: v.price, stock: row.stock, imageUrl: v.image_url, comments: v.comments })
  })
  return result
}

// mode 4 = tamaño fijo en píxeles, igual que Mallas, para que todas las
// fotos midan lo mismo en la tabla sin importar el tamaño real de la imagen.
function imageFormula(url: string | null): string {
  return url ? `=IMAGE("${url}",4,100,100)` : ''
}

function sortValvuleriaRows(rows: ValvuleriaMasterRow[]): ValvuleriaMasterRow[] {
  return [...rows].sort((a, b) => (a.brand || 'Sin marca').localeCompare(b.brand || 'Sin marca') || a.name.localeCompare(b.name))
}

// -------- Fase A: leer la pestaña y detectar qué cambió del lado del personal --------
// Mismas reglas de valor inválido ya probadas para Pisos/Mallas/Cenefas/Adhesivos.

interface ParsedValvuleriaRow {
  valvuleriaId: string
  rowIndex1: number
  name: string
  price: number | null
  priceInvalid: boolean
  stock: number
  stockInvalid: boolean
  trackedName: string
  trackedPrice: number | null
  sku: string
  trackedSku: string
  // Control 100% manual del encargado de inventarios — ver el mismo campo
  // en sheetSync.ts (Pisos). Solo se lee para preservarla en una
  // reconstrucción completa, el sync nunca la compara ni la escribe.
  fechaActualizacion: string
  // Notas libres (ej. "a este juego le falta la pieza X") — a diferencia de
  // fechaActualizacion, ESTA sí se sincroniza con la BDD/el formulario web,
  // mismo patrón que sku/trackedSku.
  comentarios: string
  trackedComentarios: string
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

function parseValvuleriaTabRows(rows: CellValue[][]): ParsedValvuleriaRow[] {
  const out: ParsedValvuleriaRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const valvuleriaId = cellIdText(r[COL_VALVULERIA.VALVULERIA_ID])
    if (!valvuleriaId) continue

    const priceText = cellIdText(r[COL_VALVULERIA.PRECIO])
    const priceNum = cellNum(r[COL_VALVULERIA.PRECIO])
    const priceInvalid = (priceText !== '' && priceNum === null) || (priceNum !== null && priceNum < 0)

    const stockText = cellIdText(r[COL_VALVULERIA.CANTIDAD])
    const stockNum = cellNum(r[COL_VALVULERIA.CANTIDAD])
    const stockInvalid = (stockText !== '' && stockNum === null) || (stockNum !== null && stockNum < 0)

    out.push({
      valvuleriaId,
      rowIndex1: i + 1,
      name: cellRaw(r[COL_VALVULERIA.DESCRIPCION]),
      price: priceNum,
      priceInvalid,
      stock: stockInvalid ? 0 : (stockNum ?? 0),
      stockInvalid,
      trackedName: cellRaw(r[COL_VALVULERIA.LAST_SYNCED_NAME]),
      trackedPrice: cellNum(r[COL_VALVULERIA.LAST_SYNCED_PRICE]),
      sku: cellIdText(r[COL_VALVULERIA.SKU]),
      trackedSku: cellIdText(r[COL_VALVULERIA.LAST_SYNCED_SKU]),
      fechaActualizacion: cellRaw(r[COL_VALVULERIA.FECHA_ACTUALIZACION]),
      comentarios: cellRaw(r[COL_VALVULERIA.COMENTARIOS]),
      trackedComentarios: cellRaw(r[COL_VALVULERIA.LAST_SYNCED_COMMENTS]),
    })
  }
  return out
}

interface ValvuleriaBodegaSheetState {
  config: BodegaConfig
  tab: TabInfo | null
  rows: ParsedValvuleriaRow[]
}

interface ValvuleriaPullMapEntry { name?: string; price?: number | null; sku?: string | null; comments?: string | null }

interface ValvuleriaPullOutcome {
  pullMap: Map<string, ValvuleriaPullMapEntry>
  stockPushes: { valvuleriaId: string; bodega: string; stock: number }[]
  conflicts: { valvuleriaId: string; field: 'name' | 'price' | 'sku' | 'comments' }[]
  sheetStates: ValvuleriaBodegaSheetState[]
}

async function pullValvuleriaPhase(
  sheets: sheets_v4.Sheets,
  configs: BodegaConfig[],
  masterBefore: Map<string, ValvuleriaMasterRow[]>,
  invocationId: string,
): Promise<ValvuleriaPullOutcome> {
  const pullMap = new Map<string, ValvuleriaPullMapEntry>()
  const stockPushes: ValvuleriaPullOutcome['stockPushes'] = []
  const conflicts: ValvuleriaPullOutcome['conflicts'] = []
  const sheetStates: ValvuleriaBodegaSheetState[] = []

  for (const config of configs) {
    const validIds = new Set((masterBefore.get(config.bodega) || []).map(r => r.valvuleriaId))

    console.log(`[sync-valvuleria ${invocationId}] listTabs bodega=${config.bodega} spreadsheetId=${config.spreadsheetId}`)
    const tabs = await listTabs(sheets, config.spreadsheetId)
    const tab = tabs.find(t => t.title === VALVULERIA_TAB_NAME) || null

    let rows: ParsedValvuleriaRow[] = []
    if (tab) {
      const values = await batchGetTabValues(sheets, config.spreadsheetId, [VALVULERIA_TAB_NAME])
      rows = parseValvuleriaTabRows(values.get(VALVULERIA_TAB_NAME) || [])
      for (const row of rows) {
        if (!validIds.has(row.valvuleriaId)) continue

        if (!row.stockInvalid) {
          stockPushes.push({ valvuleriaId: row.valvuleriaId, bodega: config.bodega, stock: row.stock })
        }

        if (row.name && row.name !== row.trackedName) {
          const existing = pullMap.get(row.valvuleriaId)
          if (existing?.name !== undefined && existing.name !== row.name) conflicts.push({ valvuleriaId: row.valvuleriaId, field: 'name' })
          pullMap.set(row.valvuleriaId, { ...existing, name: row.name })
        }
        if (!row.priceInvalid && row.price !== row.trackedPrice) {
          const existing = pullMap.get(row.valvuleriaId)
          if (existing?.price !== undefined && existing.price !== row.price) conflicts.push({ valvuleriaId: row.valvuleriaId, field: 'price' })
          pullMap.set(row.valvuleriaId, { ...existing, price: row.price })
        }
        if (row.sku !== row.trackedSku) {
          const existing = pullMap.get(row.valvuleriaId)
          if (existing?.sku !== undefined && existing.sku !== (row.sku || null)) conflicts.push({ valvuleriaId: row.valvuleriaId, field: 'sku' })
          pullMap.set(row.valvuleriaId, { ...existing, sku: row.sku || null })
        }
        if (row.comentarios !== row.trackedComentarios) {
          const existing = pullMap.get(row.valvuleriaId)
          if (existing?.comments !== undefined && existing.comments !== (row.comentarios || null)) conflicts.push({ valvuleriaId: row.valvuleriaId, field: 'comments' })
          pullMap.set(row.valvuleriaId, { ...existing, comments: row.comentarios || null })
        }
      }
    }
    sheetStates.push({ config, tab, rows })
  }

  return { pullMap, stockPushes, conflicts, sheetStates }
}

async function recomputeValvuleriaStockTotal(supabase: ReturnType<typeof createPlainSupabaseClient>, valvuleriaId: string) {
  const { data } = await supabase.from('valvuleria_bodega_stock').select('stock').eq('valvuleria_id', valvuleriaId)
  const total = (data || []).reduce((sum: number, r: { stock: number }) => sum + r.stock, 0)
  await supabase.from('valvuleria').update({ stock: total }).eq('id', valvuleriaId)
}

async function applyValvuleriaPulls(
  supabase: ReturnType<typeof createPlainSupabaseClient>,
  pullMap: ValvuleriaPullOutcome['pullMap'],
  stockPushes: ValvuleriaPullOutcome['stockPushes'],
) {
  await Promise.all(Array.from(pullMap.entries()).map(async ([id, changes]) => {
    const patch: Record<string, unknown> = {}
    if (changes.name !== undefined) patch.name = changes.name
    if (changes.price !== undefined) patch.price = changes.price
    if (changes.sku !== undefined) patch.sku = changes.sku
    if (changes.comments !== undefined) patch.comments = changes.comments
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from('valvuleria').update(patch).eq('id', id)
      if (error) console.error(`[sync-valvuleria] no se pudo aplicar el cambio de Sheets al producto ${id}: ${error.message}`)
    }
  }))

  await Promise.all(stockPushes.map(s =>
    supabase.from('valvuleria_bodega_stock').upsert({ valvuleria_id: s.valvuleriaId, bodega: s.bodega, stock: s.stock }, { onConflict: 'valvuleria_id,bodega' })
  ))

  const affected = new Set<string>([...pullMap.keys(), ...stockPushes.map(s => s.valvuleriaId)])
  await Promise.all(Array.from(affected).map(id => recomputeValvuleriaStockTotal(supabase, id)))
}

// -------- Fase B: reconciliar la pestaña contra los datos ya actualizados --------

function buildValvuleriaTabContentValues(rows: ValvuleriaMasterRow[], preservedFechas: Map<string, string>): (string | number)[][] {
  // FOTO (col 0) va en blanco aquí a propósito: este arreglo se escribe con
  // RAW (ver batchWriteCells), que guardaría la fórmula =IMAGE(...) como
  // texto literal en vez de evaluarla. Se llena aparte con
  // buildValvuleriaFotoValues() en una llamada separada con USER_ENTERED.
  // COMENTARIOS (a diferencia de FECHA_ACTUALIZACION) sí viene de la BDD —
  // se escribe tal cual, igual que SKU, junto con su columna de rastreo.
  return sortValvuleriaRows(rows).map(it => [
    '', it.brand || 'Sin marca', it.sku ?? '', it.name, it.stock, it.precio ?? '', preservedFechas.get(it.valvuleriaId) || '', it.comments ?? '',
    it.valvuleriaId, it.name, it.precio ?? '', it.sku ?? '', it.comments ?? '',
  ])
}

function buildValvuleriaFotoValues(rows: ValvuleriaMasterRow[]): string[][] {
  return sortValvuleriaRows(rows).map(it => [imageFormula(it.imageUrl)])
}

export interface ValvuleriaBodegaResult { bodega: string; rebuilt: boolean; cellsWritten: number; error?: string; needsReview?: boolean }

async function reconcileValvuleriaBodega(
  sheets: sheets_v4.Sheets,
  state: ValvuleriaBodegaSheetState,
  freshRows: ValvuleriaMasterRow[],
  allowStructural: boolean,
  invocationId: string,
): Promise<ValvuleriaBodegaResult> {
  const { config, tab, rows: actualRows } = state
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!

  const isNewTab = !tab
  let sheetId = tab?.sheetId

  if (isNewTab) {
    if (!allowStructural) return { bodega: config.bodega, rebuilt: false, cellsWritten: 0, needsReview: true }
    const created = await createMissingTabs(sheets, config.spreadsheetId, [VALVULERIA_TAB_NAME])
    sheetId = created.get(VALVULERIA_TAB_NAME)
    if (sheetId == null) return { bodega: config.bodega, rebuilt: false, cellsWritten: 0, error: 'No se pudo crear la pestaña Valvulería' }
  }

  const desiredIds = new Set(freshRows.map(r => r.valvuleriaId))
  const actualIds = new Set(actualRows.map(r => r.valvuleriaId))
  const structurallyDifferent = isNewTab || desiredIds.size !== actualIds.size || [...desiredIds].some(id => !actualIds.has(id))

  if (structurallyDifferent && !allowStructural) {
    return { bodega: config.bodega, rebuilt: false, cellsWritten: 0, needsReview: true }
  }

  const structural: sheets_v4.Schema$Request[] = []
  const writes: { range: string; values: (string | number)[][] }[] = []
  // Aparte del resto: =IMAGE(...) solo se evalúa como fórmula si se escribe
  // con USER_ENTERED, pero eso mismo arriesgaría que Sheets "interprete" mal
  // el resto de las columnas (ej. un SKU o nombre que por casualidad se vea
  // como fecha/número) — así que estas van en su propia llamada.
  const fotoWrites: { range: string; values: string[][] }[] = []
  const toClear: string[] = []
  let rebuilt = false

  if (isNewTab || structurallyDifferent) {
    if (!isNewTab) {
      const { protectedRangeIds, conditionalFormatCount } = await getSheetProtectionState(sheets, config.spreadsheetId, sheetId!)
      structural.push(...buildClearProtectionsAndFormatsRequests(sheetId!, protectedRangeIds, conditionalFormatCount))
    }
    structural.push(...buildValvuleriaProtectionRequests(sheetId!, serviceAccountEmail, freshRows.length, isFullyEditableBodega(config.bodega)))
    structural.push(buildFreezeHeaderRequest(sheetId!))
    structural.push(buildValvuleriaZeroStockHighlightRequest(sheetId!))
    structural.push(buildValvuleriaLowStockHighlightRequest(sheetId!))
    writes.push({ range: rowRangeValvuleria(VALVULERIA_TAB_NAME, 1, 1), values: [HEADERS_VALVULERIA] })
  }
  structural.push(...buildValvuleriaHideColumnsRequest(sheetId!))
  structural.push(...buildValvuleriaRepeatableStyleRequests(sheetId!))

  if (structurallyDifferent) {
    if (!isNewTab) toClear.push(VALVULERIA_TAB_NAME)
    const preservedFechas = new Map(actualRows.map(r => [r.valvuleriaId, r.fechaActualizacion]))
    const values = buildValvuleriaTabContentValues(freshRows, preservedFechas)
    if (values.length > 0) {
      writes.push({ range: rowRangeValvuleria(VALVULERIA_TAB_NAME, 2, 1 + values.length), values })
      fotoWrites.push({ range: colRange(VALVULERIA_TAB_NAME, COL_VALVULERIA.FOTO, 2, 1 + values.length), values: buildValvuleriaFotoValues(freshRows) })
    }
    rebuilt = true
  } else {
    const byId = new Map(freshRows.map(r => [r.valvuleriaId, r]))
    for (const row of actualRows) {
      const authoritative = byId.get(row.valvuleriaId)
      if (!authoritative) continue
      // La foto no se lee de vuelta de la hoja (es de solo escritura, como
      // MARCA), así que se reaplica siempre en vez de compararla — barato y
      // garantiza que quede al día si la imagen cambió en la página sin que
      // hubiera altas/bajas que dispararan una reconstrucción completa.
      fotoWrites.push({ range: cellRange(VALVULERIA_TAB_NAME, COL_VALVULERIA.FOTO, row.rowIndex1), values: [[imageFormula(authoritative.imageUrl)]] })
      if (row.name !== authoritative.name) {
        writes.push({ range: cellRange(VALVULERIA_TAB_NAME, COL_VALVULERIA.DESCRIPCION, row.rowIndex1), values: [[authoritative.name]] })
      }
      if (row.trackedName !== authoritative.name) {
        writes.push({ range: cellRange(VALVULERIA_TAB_NAME, COL_VALVULERIA.LAST_SYNCED_NAME, row.rowIndex1), values: [[authoritative.name]] })
      }
      if (row.price !== authoritative.precio) {
        writes.push({ range: cellRange(VALVULERIA_TAB_NAME, COL_VALVULERIA.PRECIO, row.rowIndex1), values: [[authoritative.precio ?? '']] })
      }
      if (row.trackedPrice !== authoritative.precio) {
        writes.push({ range: cellRange(VALVULERIA_TAB_NAME, COL_VALVULERIA.LAST_SYNCED_PRICE, row.rowIndex1), values: [[authoritative.precio ?? '']] })
      }
      if (row.stock !== authoritative.stock) {
        writes.push({ range: cellRange(VALVULERIA_TAB_NAME, COL_VALVULERIA.CANTIDAD, row.rowIndex1), values: [[authoritative.stock]] })
      }
      if (row.sku !== (authoritative.sku ?? '')) {
        writes.push({ range: cellRange(VALVULERIA_TAB_NAME, COL_VALVULERIA.SKU, row.rowIndex1), values: [[authoritative.sku ?? '']] })
      }
      if (row.trackedSku !== (authoritative.sku ?? '')) {
        writes.push({ range: cellRange(VALVULERIA_TAB_NAME, COL_VALVULERIA.LAST_SYNCED_SKU, row.rowIndex1), values: [[authoritative.sku ?? '']] })
      }
      if (row.comentarios !== (authoritative.comments ?? '')) {
        writes.push({ range: cellRange(VALVULERIA_TAB_NAME, COL_VALVULERIA.COMENTARIOS, row.rowIndex1), values: [[authoritative.comments ?? '']] })
      }
      if (row.trackedComentarios !== (authoritative.comments ?? '')) {
        writes.push({ range: cellRange(VALVULERIA_TAB_NAME, COL_VALVULERIA.LAST_SYNCED_COMMENTS, row.rowIndex1), values: [[authoritative.comments ?? '']] })
      }
    }
  }

  console.log(`[sync-valvuleria ${invocationId}] write bodega=${config.bodega} spreadsheetId=${config.spreadsheetId} rebuilt=${rebuilt} writes=${writes.length + fotoWrites.length}`)
  await batchClearTabs(sheets, config.spreadsheetId, toClear)
  await applyStructuralRequests(sheets, config.spreadsheetId, structural)
  await batchWriteCells(sheets, config.spreadsheetId, writes)
  await batchWriteCells(sheets, config.spreadsheetId, fotoWrites, 'USER_ENTERED')

  return { bodega: config.bodega, rebuilt, cellsWritten: writes.length + fotoWrites.length }
}

// Mismo criterio de seguridad que assertBodegaMembership en sheetSync.ts: antes
// de escribir, se vuelve a consultar valvuleria_bodega_stock desde cero para
// esta bodega específica y se confirma que coincide con lo que se va a escribir.
async function assertValvuleriaBodegaMembership(supabase: ReturnType<typeof createPlainSupabaseClient>, bodega: string, rows: ValvuleriaMasterRow[]) {
  const { data, error } = await supabase.from('valvuleria_bodega_stock').select('valvuleria_id').eq('bodega', bodega)
  if (error) throw new Error(`Verificación de seguridad falló (valvulería, ${bodega}): ${error.message}`)
  const realIds = new Set((data || []).map(r => r.valvuleria_id))
  const extra = rows.map(r => r.valvuleriaId).filter(id => !realIds.has(id))
  if (extra.length > 0) {
    throw new Error(`Verificación de seguridad falló (valvulería, ${bodega}): ${extra.length} producto(s) no pertenecen realmente a esta bodega (ej. ${extra[0]}) — se aborta.`)
  }
}

export async function syncValvuleriaForBodegas(
  sheets: sheets_v4.Sheets,
  supabase: ReturnType<typeof createPlainSupabaseClient>,
  configs: BodegaConfig[],
  allowStructural: boolean,
  invocationId: string,
): Promise<ValvuleriaBodegaResult[]> {
  const bodegaNames = configs.map(c => c.bodega)

  const masterBeforePulls = await fetchValvuleriaMasterData(supabase, bodegaNames)
  const { pullMap, stockPushes, sheetStates } = await pullValvuleriaPhase(sheets, configs, masterBeforePulls, invocationId)

  await applyValvuleriaPulls(supabase, pullMap, stockPushes)

  const freshMaster = await fetchValvuleriaMasterData(supabase, bodegaNames)

  const results: ValvuleriaBodegaResult[] = []
  for (const state of sheetStates) {
    try {
      const rowsForBodega = freshMaster.get(state.config.bodega) || []
      await assertValvuleriaBodegaMembership(supabase, state.config.bodega, rowsForBodega)
      results.push(await reconcileValvuleriaBodega(sheets, state, rowsForBodega, allowStructural, invocationId))
    } catch (err) {
      results.push({ bodega: state.config.bodega, rebuilt: false, cellsWritten: 0, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return results
}
