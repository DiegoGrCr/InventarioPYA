import { sheets_v4 } from 'googleapis'
import { WAREHOUSES } from './types'
import { createPlainSupabaseClient } from './supabase/plainClient'
import { groupByBrand, sortByFormatoThenName, groupConsecutiveByFormato, sanitizeTabName } from './inventoryGrouping'
import {
  getSheetsClient, listTabs, batchGetTabValues, batchWriteCells, batchClearTabs,
  applyStructuralRequests, createMissingTabs, buildProtectionRequests, buildHideColumnsRequest,
  buildFreezeHeaderRequest, buildUnmergeRequest, buildMergeRequest, cellRange, rowRange,
  buildRepeatableStyleRequests, buildZeroStockHighlightRequest, buildLowStockHighlightRequest,
  getSheetProtectionState, buildClearProtectionsAndFormatsRequests,
  COL, HEADERS, TabInfo, CellValue, MESH_TAB_NAME, ACCESSORY_TAB_NAME, CENEFA_TAB_NAME,
} from './googleSheets'
import { syncAccessoriesForBodegas, AccessoryBodegaResult } from './accessorySheetSync'
import { syncMeshesForBodegas, MeshBodegaResult } from './meshSheetSync'
import { syncCenefasForBodegas, CenefaBodegaResult } from './cenefaSheetSync'

// -------- Configuración de bodegas (qué archivos de Sheets están activos) --------

function envSlug(bodega: string): string {
  return bodega
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export interface BodegaConfig { bodega: string; spreadsheetId: string }

export function getConfiguredBodegas(): BodegaConfig[] {
  return WAREHOUSES
    .map((bodega): BodegaConfig => ({ bodega, spreadsheetId: process.env[`GOOGLE_SHEET_ID_${envSlug(bodega)}`] || '' }))
    .filter(c => c.spreadsheetId !== '')
    .sort((a, b) => a.bodega.localeCompare(b.bodega))
}

// Bodegas donde, además de nombre/precio/cajas, el personal también puede
// editar SKU/piezas por caja/m² por caja/precio directamente en Sheets (con
// su propio rastreo _last_synced_* para no perder el cambio en la siguiente
// corrida) — el resto se queda con el criterio más restringido de siempre.
const FULLY_EDITABLE_BODEGAS = ['La Playita']
export function isFullyEditableBodega(bodega: string): boolean {
  return FULLY_EDITABLE_BODEGAS.includes(bodega)
}

// -------- Datos maestros (BDD → qué DEBERÍA haber en cada hoja) --------

interface MasterRow {
  productId: string
  name: string
  brand: string
  formato: string
  sku: string | null
  area: number
  piezas: number | null
  m2: number | null
  precio: number | null
  stock: number
}

async function fetchMasterData(supabase: ReturnType<typeof createPlainSupabaseClient>, bodegas: string[]): Promise<Map<string, MasterRow[]>> {
  const result = new Map<string, MasterRow[]>()
  bodegas.forEach(b => result.set(b, []))
  if (bodegas.length === 0) return result

  const { data, error } = await supabase
    .from('product_bodega_stock')
    .select('bodega, stock, product:products!inner(id, name, sku, price_per_sqm, sale_unit, pieces_per_box, sqm_per_box, is_active, brand:brands(name), size:sizes(label, width, height))')
    .in('bodega', bodegas)
    .eq('product.is_active', true)

  if (error) throw new Error(`Error leyendo product_bodega_stock: ${error.message}`)

  interface ProductJoin {
    id: string; name: string; sku: string | null; price_per_sqm: number | null; sale_unit: 'caja' | 'pieza'
    pieces_per_box: number | null; sqm_per_box: number | null
    brand: { name: string } | null; size: { label: string; width: number; height: number } | null
  }

  ;(data || []).forEach(row => {
    const p = row.product as unknown as ProductJoin | null
    if (!p) return
    const list = result.get(row.bodega)
    if (!list) return
    list.push({
      productId: p.id,
      name: p.name,
      brand: p.brand?.name || 'Sin marca',
      formato: p.size?.label || 'Sin medida',
      sku: p.sku,
      area: p.size ? p.size.width * p.size.height : 0,
      piezas: p.sale_unit === 'pieza' ? null : p.pieces_per_box,
      m2: p.sqm_per_box,
      precio: p.price_per_sqm,
      stock: row.stock,
    })
  })
  return result
}

// -------- Fase A: leer las hojas y detectar qué cambió del lado del personal --------

interface ParsedSheetRow {
  productId: string
  rowIndex1: number // fila real (1-based) dentro de la pestaña, para direccionar celdas
  name: string
  price: number | null
  priceInvalid: boolean // true si la celda tiene texto que no es un número (no vacía)
  stock: number
  stockInvalid: boolean // true si la celda tiene texto que no es un número válido (>=0), incl. vacía/negativa
  trackedName: string
  trackedPrice: number | null
  sku: string
  trackedSku: string
  piezas: number | null
  piezasInvalid: boolean
  trackedPiezas: number | null
  m2: number | null
  m2Invalid: boolean
  trackedM2: number | null
}

// Con UNFORMATTED_VALUE, Sheets ya regresa números como number (no string), pero
// una celda vacía sigue viniendo como '' o undefined — de ahí el manejo mixto.
// IMPORTANTE: NO usar trim() en valores de texto que deban comparar exacto
// contra la BDD (nombre) — si el nombre real tiene un espacio al final, un
// trim() al leer haría que esa diferencia nunca converja (se "corrige" en cada
// corrida sin fin, porque la siguiente lectura vuelve a quitar el espacio).
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

function parseTabRows(rows: CellValue[][]): ParsedSheetRow[] {
  const out: ParsedSheetRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const productId = cellIdText(r[COL.PRODUCT_ID])
    if (!productId) continue

    // Inválido = tiene contenido pero no es un número, o es un número negativo
    // (precio/stock no pueden ser negativos). Vacío SÍ es válido (precio nulo /
    // stock en 0) — eso es un valor intencional, no un error de captura.
    const priceText = cellIdText(r[COL.PRECIO])
    const priceNum = cellNum(r[COL.PRECIO])
    const priceInvalid = (priceText !== '' && priceNum === null) || (priceNum !== null && priceNum < 0)

    const stockText = cellIdText(r[COL.CAJAS_EN_EXISTENCIA])
    const stockNum = cellNum(r[COL.CAJAS_EN_EXISTENCIA])
    const stockInvalid = (stockText !== '' && stockNum === null) || (stockNum !== null && stockNum < 0)

    const piezasText = cellIdText(r[COL.PIEZAS_X_CAJA])
    const piezasNum = cellNum(r[COL.PIEZAS_X_CAJA])
    const piezasInvalid = (piezasText !== '' && piezasNum === null) || (piezasNum !== null && piezasNum < 0)

    const m2Text = cellIdText(r[COL.M2_X_CAJA])
    const m2Num = cellNum(r[COL.M2_X_CAJA])
    const m2Invalid = (m2Text !== '' && m2Num === null) || (m2Num !== null && m2Num < 0)

    out.push({
      productId,
      rowIndex1: i + 1,
      name: cellRaw(r[COL.DESCRIPCION]),
      price: priceNum,
      priceInvalid,
      stock: stockInvalid ? 0 : (stockNum ?? 0),
      stockInvalid,
      trackedName: cellRaw(r[COL.LAST_SYNCED_NAME]),
      trackedPrice: cellNum(r[COL.LAST_SYNCED_PRICE]),
      sku: cellIdText(r[COL.SKU]),
      trackedSku: cellIdText(r[COL.LAST_SYNCED_SKU]),
      piezas: piezasNum,
      piezasInvalid,
      trackedPiezas: cellNum(r[COL.LAST_SYNCED_PIEZAS]),
      m2: m2Num,
      m2Invalid,
      trackedM2: cellNum(r[COL.LAST_SYNCED_M2]),
    })
  }
  return out
}

interface BodegaSheetState {
  config: BodegaConfig
  tabs: TabInfo[]
  rowsByTab: Map<string, ParsedSheetRow[]>
}

interface PullMapEntry { name?: string; price?: number | null; sku?: string | null; piezas?: number | null; m2?: number | null }

interface PullOutcome {
  pullMap: Map<string, PullMapEntry>
  stockPushes: { productId: string; bodega: string; stock: number }[]
  conflicts: { productId: string; field: 'name' | 'price' | 'sku' | 'piezas' | 'm2' }[]
  sheetStates: BodegaSheetState[]
}

async function pullPhase(
  sheets: sheets_v4.Sheets,
  configs: BodegaConfig[],
  masterBefore: Map<string, MasterRow[]>,
  invocationId: string,
): Promise<PullOutcome> {
  const pullMap = new Map<string, PullMapEntry>()
  const stockPushes: PullOutcome['stockPushes'] = []
  const conflicts: PullOutcome['conflicts'] = []
  const sheetStates: BodegaSheetState[] = []

  for (const config of configs) {
    // Solo se toman en cuenta filas de productos que SIGUEN asignados a esta
    // bodega según la BDD. Si un producto ya no está asignado (el admin le
    // quitó la bodega) pero su fila sigue físicamente en la hoja porque el
    // personal no la borró, esa fila es huérfana: se ignora por completo aquí
    // (ni stock ni nombre/precio) — si no, el upsert de stock la resucitaría
    // en cada corrida y la Fase B nunca podría eliminarla del todo.
    const validIds = new Set((masterBefore.get(config.bodega) || []).map(r => r.productId))

    // Rastro permanente (barato) para poder detectar en los logs de Vercel si
    // dos invocaciones llegan a solaparse — ver commit que quitó el cliente
    // de Sheets cacheado a nivel de módulo para el porqué de esto.
    console.log(`[sync ${invocationId}] listTabs bodega=${config.bodega} spreadsheetId=${config.spreadsheetId}`)
    const tabs = await listTabs(sheets, config.spreadsheetId)
    const rowsByTab = new Map<string, ParsedSheetRow[]>()
    if (tabs.length > 0) {
      const values = await batchGetTabValues(sheets, config.spreadsheetId, tabs.map(t => t.title))
      for (const tab of tabs) {
        const rows = parseTabRows(values.get(tab.title) || [])
        rowsByTab.set(tab.title, rows)
        for (const row of rows) {
          if (!validIds.has(row.productId)) continue

          // Un valor inválido (texto donde va un número, o negativo) NUNCA se
          // aplica a la BDD — se ignora esta fila para ese campo, y la Fase B
          // se encarga de corregir la celda de vuelta al valor real.
          if (!row.stockInvalid) {
            stockPushes.push({ productId: row.productId, bodega: config.bodega, stock: row.stock })
          }

          if (row.name && row.name !== row.trackedName) {
            const existing = pullMap.get(row.productId)
            if (existing?.name !== undefined && existing.name !== row.name) conflicts.push({ productId: row.productId, field: 'name' })
            pullMap.set(row.productId, { ...existing, name: row.name })
          }
          if (!row.priceInvalid && row.price !== row.trackedPrice) {
            const existing = pullMap.get(row.productId)
            if (existing?.price !== undefined && existing.price !== row.price) conflicts.push({ productId: row.productId, field: 'price' })
            pullMap.set(row.productId, { ...existing, price: row.price })
          }
          // SKU/piezas/m² solo se pueden editar de verdad en las bodegas
          // "totalmente editables" (protegidos con celda bloqueada en el
          // resto) — pero comparar contra su columna de rastreo aquí es
          // seguro para TODAS las bodegas: donde está protegida, el valor y
          // su rastreo siempre coinciden, así que nunca se detecta un cambio.
          if (row.sku !== row.trackedSku) {
            const existing = pullMap.get(row.productId)
            if (existing?.sku !== undefined && existing.sku !== (row.sku || null)) conflicts.push({ productId: row.productId, field: 'sku' })
            pullMap.set(row.productId, { ...existing, sku: row.sku || null })
          }
          if (!row.piezasInvalid && row.piezas !== row.trackedPiezas) {
            const existing = pullMap.get(row.productId)
            if (existing?.piezas !== undefined && existing.piezas !== row.piezas) conflicts.push({ productId: row.productId, field: 'piezas' })
            pullMap.set(row.productId, { ...existing, piezas: row.piezas })
          }
          if (!row.m2Invalid && row.m2 !== row.trackedM2) {
            const existing = pullMap.get(row.productId)
            if (existing?.m2 !== undefined && existing.m2 !== row.m2) conflicts.push({ productId: row.productId, field: 'm2' })
            pullMap.set(row.productId, { ...existing, m2: row.m2 })
          }
        }
      }
    }
    sheetStates.push({ config, tabs, rowsByTab })
  }

  return { pullMap, stockPushes, conflicts, sheetStates }
}

async function recomputeStockTotal(supabase: ReturnType<typeof createPlainSupabaseClient>, productId: string) {
  const { data } = await supabase.from('product_bodega_stock').select('stock').eq('product_id', productId)
  const total = (data || []).reduce((sum: number, r: { stock: number }) => sum + r.stock, 0)
  await supabase.from('products').update({ stock: total }).eq('id', productId)
}

async function applyPulls(
  supabase: ReturnType<typeof createPlainSupabaseClient>,
  master: Map<string, MasterRow[]>,
  pullMap: PullOutcome['pullMap'],
  stockPushes: PullOutcome['stockPushes'],
) {
  const sqmByProduct = new Map<string, number | null>()
  const priceByProduct = new Map<string, number | null>()
  master.forEach(rows => rows.forEach(r => {
    if (!sqmByProduct.has(r.productId)) sqmByProduct.set(r.productId, r.m2)
    if (!priceByProduct.has(r.productId)) priceByProduct.set(r.productId, r.precio)
  }))

  await Promise.all(Array.from(pullMap.entries()).map(async ([id, changes]) => {
    const patch: Record<string, unknown> = {}
    if (changes.name !== undefined) patch.name = changes.name
    if (changes.sku !== undefined) patch.sku = changes.sku
    if (changes.piezas !== undefined) patch.pieces_per_box = changes.piezas
    if (changes.price !== undefined) patch.price_per_sqm = changes.price
    if (changes.m2 !== undefined) patch.sqm_per_box = changes.m2

    // price_per_box depende de precio Y m², así que si cualquiera de los dos
    // cambió en esta misma corrida hay que recalcularlo con el valor FINAL de
    // ambos (no el que ya estaba en la BDD antes de este pull).
    if (changes.price !== undefined || changes.m2 !== undefined) {
      const finalPrice = changes.price !== undefined ? changes.price : (priceByProduct.get(id) ?? null)
      const finalSqm = changes.m2 !== undefined ? changes.m2 : (sqmByProduct.get(id) ?? null)
      patch.price_per_box = (finalPrice != null && finalSqm) ? parseFloat((finalPrice * finalSqm).toFixed(2)) : null
    }

    if (Object.keys(patch).length > 0) {
      // SKU tiene restricción UNIQUE — si el personal escribe uno repetido,
      // que falle solo esa actualización (se queda como estaba, la Fase B lo
      // corrige de vuelta) en vez de tumbar el resto de la sincronización.
      const { error } = await supabase.from('products').update(patch).eq('id', id)
      if (error) console.error(`[sync] no se pudo aplicar el cambio de Sheets al producto ${id}: ${error.message}`)
    }
  }))

  await Promise.all(stockPushes.map(s =>
    supabase.from('product_bodega_stock').upsert({ product_id: s.productId, bodega: s.bodega, stock: s.stock }, { onConflict: 'product_id,bodega' })
  ))

  const affected = new Set<string>([...pullMap.keys(), ...stockPushes.map(s => s.productId)])
  await Promise.all(Array.from(affected).map(id => recomputeStockTotal(supabase, id)))
}

// -------- Fase B: reconciliar cada pestaña contra los datos ya actualizados --------

function buildTabContentValues(rows: MasterRow[]): (string | number)[][] {
  return sortByFormatoThenName(rows).map(it => [
    it.formato, it.sku ?? '', it.name, it.piezas ?? '', it.m2 ?? '', it.stock, it.precio ?? '',
    it.productId, it.name, it.precio ?? '', it.sku ?? '', it.piezas ?? '', it.m2 ?? '',
  ])
}

function buildMergeRequestsForGroups(sheetId: number, rows: MasterRow[]): sheets_v4.Schema$Request[] {
  const requests: sheets_v4.Schema$Request[] = []
  let rowCursor1 = 2 // fila 1 = headers
  groupConsecutiveByFormato(sortByFormatoThenName(rows)).forEach(group => {
    const startRow0 = rowCursor1 - 1
    rowCursor1 += group.items.length
    const endRow0 = rowCursor1 - 1
    if (endRow0 - startRow0 > 1) requests.push(buildMergeRequest(sheetId, startRow0, endRow0))
  })
  return requests
}

interface BodegaResult { bodega: string; rebuiltTabs: string[]; cellsWritten: number; error?: string; needsReview?: string[] }

async function reconcileBodega(
  sheets: sheets_v4.Sheets,
  state: BodegaSheetState,
  freshRows: MasterRow[],
  allowStructural: boolean,
  invocationId: string,
): Promise<BodegaResult> {
  const { config, tabs, rowsByTab } = state
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!

  const byBrand = groupByBrand(freshRows)
  const usedTitles = new Set<string>()
  const brandNames = Array.from(byBrand.keys()).sort((a, b) => a.localeCompare(b))
  const titleByBrand = new Map<string, string>()
  brandNames.forEach(brand => titleByBrand.set(brand, sanitizeTabName(brand, usedTitles, 90)))

  const tabByTitle = new Map(tabs.map(t => [t.title, t]))
  const newTitles = brandNames.filter(b => !tabByTitle.has(titleByBrand.get(b)!)).map(b => titleByBrand.get(b)!)

  // Crear pestañas nuevas y reconstruir pestañas completas son las únicas
  // operaciones donde, ante un origen de datos incorrecto (por la razón que
  // sea), se podría escribir contenido de OTRA bodega — así que quedan detrás
  // de este interruptor, apagado por default en el cron automático. El sync
  // normal (precio/stock/nombre en pestañas que ya coinciden) siempre corre.
  const createdSheetIds = allowStructural ? await createMissingTabs(sheets, config.spreadsheetId, newTitles) : new Map<string, number>()

  const rebuiltTabs: string[] = []
  const needsReview: string[] = []
  const toClear: string[] = []
  const structural: sheets_v4.Schema$Request[] = []
  const writes: { range: string; values: (string | number)[][] }[] = []

  for (const brand of brandNames) {
    const title = titleByBrand.get(brand)!
    const desired = byBrand.get(brand)!
    const existingTab = tabByTitle.get(title)
    const isNewTab = !existingTab
    const sheetId = existingTab?.sheetId ?? createdSheetIds.get(title)

    if (sheetId == null) {
      // allowStructural=false y esta marca no tiene pestaña todavía — se
      // reporta para revisión manual en vez de crearla sola.
      if (isNewTab) needsReview.push(title)
      continue
    }

    const actualRows = isNewTab ? [] : (rowsByTab.get(title) || [])
    const desiredIds = new Set(desired.map(r => r.productId))
    const actualIds = new Set(actualRows.map(r => r.productId))
    const structurallyDifferent = isNewTab || desiredIds.size !== actualIds.size || [...desiredIds].some(id => !actualIds.has(id))

    if (structurallyDifferent && !allowStructural) {
      needsReview.push(title)
      continue
    }

    if (isNewTab || structurallyDifferent) {
      // Protecciones y formato condicional NO son idempotentes (se apilarían
      // duplicados si se reagregan sin más) — en una pestaña ya existente que
      // se está reconstruyendo, primero hay que borrar las que tenía (podrían
      // estar protegiendo las columnas equivocadas si el layout cambió, ej.
      // se insertó una columna nueva) antes de volver a agregarlas.
      if (!isNewTab) {
        const { protectedRangeIds, conditionalFormatCount } = await getSheetProtectionState(sheets, config.spreadsheetId, sheetId)
        structural.push(...buildClearProtectionsAndFormatsRequests(sheetId, protectedRangeIds, conditionalFormatCount))
      }
      structural.push(...buildProtectionRequests(sheetId, serviceAccountEmail, isFullyEditableBodega(config.bodega)))
      structural.push(buildFreezeHeaderRequest(sheetId))
      structural.push(buildZeroStockHighlightRequest(sheetId))
      structural.push(buildLowStockHighlightRequest(sheetId))
      writes.push({ range: rowRange(title, 1, 1), values: [HEADERS] })
    }
    // El formato visual (colores, bordes, moneda, anchos, filtro) y qué
    // columnas están ocultas son idempotentes — se reaplican en cada corrida
    // para que las pestañas ya existentes también se autocorrijan (ej. si el
    // layout cambió y una columna visible había quedado oculta por accidente).
    structural.push(...buildHideColumnsRequest(sheetId))
    structural.push(...buildRepeatableStyleRequests(sheetId))

    if (structurallyDifferent) {
      if (!isNewTab) toClear.push(title)
      structural.push(buildUnmergeRequest(sheetId))
      structural.push(...buildMergeRequestsForGroups(sheetId, desired))
      const values = buildTabContentValues(desired)
      if (values.length > 0) writes.push({ range: rowRange(title, 2, 1 + values.length), values })
      rebuiltTabs.push(title)
    } else {
      const byId = new Map(desired.map(r => [r.productId, r]))
      for (const row of actualRows) {
        const authoritative = byId.get(row.productId)
        if (!authoritative) continue
        // La celda visible y su columna de rastreo se comparan por separado: la
        // bodega donde se originó un cambio ya tiene la celda visible correcta
        // (el personal la escribió ahí), pero su _last_synced_* se quedaría
        // desactualizada si solo la actualizáramos cuando la celda visible
        // también cambia — eso haría que esa fila se interprete como "recién
        // editada" en cada corrida futura y podría revertir cambios legítimos
        // posteriores (del admin o de otra bodega).
        if (row.name !== authoritative.name) {
          writes.push({ range: cellRange(title, COL.DESCRIPCION, row.rowIndex1), values: [[authoritative.name]] })
        }
        if (row.trackedName !== authoritative.name) {
          writes.push({ range: cellRange(title, COL.LAST_SYNCED_NAME, row.rowIndex1), values: [[authoritative.name]] })
        }
        if (row.price !== authoritative.precio) {
          writes.push({ range: cellRange(title, COL.PRECIO, row.rowIndex1), values: [[authoritative.precio ?? '']] })
        }
        if (row.trackedPrice !== authoritative.precio) {
          writes.push({ range: cellRange(title, COL.LAST_SYNCED_PRICE, row.rowIndex1), values: [[authoritative.precio ?? '']] })
        }
        if (row.stock !== authoritative.stock) {
          writes.push({ range: cellRange(title, COL.CAJAS_EN_EXISTENCIA, row.rowIndex1), values: [[authoritative.stock]] })
        }
        if (row.sku !== (authoritative.sku ?? '')) {
          writes.push({ range: cellRange(title, COL.SKU, row.rowIndex1), values: [[authoritative.sku ?? '']] })
        }
        if (row.trackedSku !== (authoritative.sku ?? '')) {
          writes.push({ range: cellRange(title, COL.LAST_SYNCED_SKU, row.rowIndex1), values: [[authoritative.sku ?? '']] })
        }
        if (row.piezas !== authoritative.piezas) {
          writes.push({ range: cellRange(title, COL.PIEZAS_X_CAJA, row.rowIndex1), values: [[authoritative.piezas ?? '']] })
        }
        if (row.trackedPiezas !== authoritative.piezas) {
          writes.push({ range: cellRange(title, COL.LAST_SYNCED_PIEZAS, row.rowIndex1), values: [[authoritative.piezas ?? '']] })
        }
        if (row.m2 !== authoritative.m2) {
          writes.push({ range: cellRange(title, COL.M2_X_CAJA, row.rowIndex1), values: [[authoritative.m2 ?? '']] })
        }
        if (row.trackedM2 !== authoritative.m2) {
          writes.push({ range: cellRange(title, COL.LAST_SYNCED_M2, row.rowIndex1), values: [[authoritative.m2 ?? '']] })
        }
      }
    }
  }

  // Limpia pestañas de marca huérfanas: tenían contenido sincronizado pero
  // esa marca ya no tiene ningún producto vigente en esta bodega (se quitó/
  // desactivó el último) — el bucle de arriba solo revisita marcas que SÍ
  // aparecen en freshRows, así que sin esto se quedarían con datos viejos
  // para siempre. oldRows.length > 0 es la señal de que el sync sí la
  // manejó alguna vez (una pestaña ajena como "Hoja 1" nunca tiene filas
  // que calcen con el layout esperado, así que no se toca).
  const managedTitles = new Set(titleByBrand.values())
  for (const tab of tabs) {
    // MESH_TAB_NAME/ACCESSORY_TAB_NAME tienen su propio layout de columnas,
    // completamente distinto al de Pisos (COL) — parseTabRows() las lee con
    // los índices EQUIVOCADOS y puede "detectar" una fila falsa ahí (ej. un
    // precio de adhesivo leído por accidente en la posición de _product_id).
    // Sin esta exclusión, esto las marcaba como huérfanas y las vaciaba,
    // justo antes de que su propio sync (accessorySheetSync/meshSheetSync)
    // fuera a leerlas — pudiendo perder una edición reciente del personal.
    if (tab.title === MESH_TAB_NAME || tab.title === ACCESSORY_TAB_NAME || tab.title === CENEFA_TAB_NAME) continue
    if (managedTitles.has(tab.title) || toClear.includes(tab.title)) continue
    const oldRows = rowsByTab.get(tab.title) || []
    if (oldRows.length === 0) continue
    toClear.push(tab.title)
  }

  console.log(`[sync ${invocationId}] write bodega=${config.bodega} spreadsheetId=${config.spreadsheetId} rebuiltTabs=${JSON.stringify(rebuiltTabs)} toClear=${JSON.stringify(toClear)} writes=${writes.length}`)
  await batchClearTabs(sheets, config.spreadsheetId, toClear)
  await applyStructuralRequests(sheets, config.spreadsheetId, structural)
  await batchWriteCells(sheets, config.spreadsheetId, writes)

  return { bodega: config.bodega, rebuiltTabs, cellsWritten: writes.length, needsReview: needsReview.length > 0 ? needsReview : undefined }
}

// -------- Orquestación --------

export interface SyncSummary {
  ranAt: string
  durationMs: number
  bodegas: BodegaResult[]
  meshBodegas: MeshBodegaResult[]
  cenefaBodegas: CenefaBodegaResult[]
  accessoryBodegas: AccessoryBodegaResult[]
  conflicts: { productId: string; field: 'name' | 'price' | 'sku' | 'piezas' | 'm2' }[]
  skipped?: boolean
}

// Evita que dos corridas se solapen (ej. un reintento del disparador externo,
// o que Vercel invoque la función más de una vez casi al mismo tiempo) — sin
// esto, dos corridas simultáneas pueden leer la hoja en momentos distintos y
// terminan reconstruyendo pestañas en bucle una contra la otra. Si el lock se
// quedó pegado por una corrida que nunca lo liberó (crash), se considera
// libre después de 5 minutos.
const LOCK_STALE_MS = 5 * 60 * 1000

async function acquireLock(supabase: ReturnType<typeof createPlainSupabaseClient>): Promise<boolean> {
  const now = new Date()
  const staleThreshold = new Date(now.getTime() - LOCK_STALE_MS).toISOString()
  const { data, error } = await supabase
    .from('sync_lock')
    .update({ locked_at: now.toISOString() })
    .eq('id', 1)
    .or(`locked_at.is.null,locked_at.lt.${staleThreshold}`)
    .select()
  if (error) throw new Error(`Error al intentar tomar el lock de sync: ${error.message}`)
  return (data?.length || 0) > 0
}

async function releaseLock(supabase: ReturnType<typeof createPlainSupabaseClient>) {
  await supabase.from('sync_lock').update({ locked_at: null }).eq('id', 1)
}

// Verificación de seguridad independiente antes de escribir cualquier cosa en
// una hoja: vuelve a consultar product_bodega_stock desde cero, filtrado
// estrictamente a ESTA bodega, y confirma que coincide exactamente con lo que
// se está a punto de escribir. Si algo no cuadra (aunque sea por una causa que
// no hayamos identificado), se aborta esa bodega en vez de escribir productos
// de otra bodega/marca por accidente.
async function assertBodegaMembership(supabase: ReturnType<typeof createPlainSupabaseClient>, bodega: string, rows: MasterRow[]) {
  const { data, error } = await supabase.from('product_bodega_stock').select('product_id').eq('bodega', bodega)
  if (error) throw new Error(`Verificación de seguridad falló (${bodega}): ${error.message}`)
  const realIds = new Set((data || []).map(r => r.product_id))
  const givenIds = rows.map(r => r.productId)
  const extra = givenIds.filter(id => !realIds.has(id))
  if (extra.length > 0) {
    throw new Error(`Verificación de seguridad falló (${bodega}): ${extra.length} producto(s) no pertenecen realmente a esta bodega (ej. ${extra[0]}) — se aborta para no escribir datos incorrectos en la hoja.`)
  }
}

export async function syncAllBodegas(options?: { allowStructural?: boolean; invocationId?: string }): Promise<SyncSummary> {
  const allowStructural = options?.allowStructural ?? true
  const invocationId = options?.invocationId ?? crypto.randomUUID()
  const startedAt = Date.now()
  const configs = getConfiguredBodegas()
  const summary: SyncSummary = { ranAt: new Date().toISOString(), durationMs: 0, bodegas: [], meshBodegas: [], cenefaBodegas: [], accessoryBodegas: [], conflicts: [] }

  if (configs.length === 0) {
    summary.durationMs = Date.now() - startedAt
    return summary
  }

  const supabase = createPlainSupabaseClient()
  const gotLock = await acquireLock(supabase)
  if (!gotLock) {
    summary.skipped = true
    summary.durationMs = Date.now() - startedAt
    return summary
  }

  try {
    const sheets = getSheetsClient()
    const bodegaNames = configs.map(c => c.bodega)

    const masterBeforePulls = await fetchMasterData(supabase, bodegaNames)
    const { pullMap, stockPushes, conflicts, sheetStates } = await pullPhase(sheets, configs, masterBeforePulls, invocationId)
    summary.conflicts = conflicts

    await applyPulls(supabase, masterBeforePulls, pullMap, stockPushes)

    const freshMaster = await fetchMasterData(supabase, bodegaNames)

    for (const state of sheetStates) {
      try {
        const rowsForBodega = freshMaster.get(state.config.bodega) || []
        await assertBodegaMembership(supabase, state.config.bodega, rowsForBodega)
        const result = await reconcileBodega(sheets, state, rowsForBodega, allowStructural, invocationId)
        summary.bodegas.push(result)
      } catch (err) {
        summary.bodegas.push({ bodega: state.config.bodega, rebuiltTabs: [], cellsWritten: 0, error: err instanceof Error ? err.message : String(err) })
      }
    }

    // Misma bodega/candado/invocación — mallas, cenefas y adhesivos van como
    // pestañas adicionales dentro del mismo archivo por bodega, no archivos aparte.
    summary.meshBodegas = await syncMeshesForBodegas(sheets, supabase, configs, allowStructural, invocationId)
    summary.cenefaBodegas = await syncCenefasForBodegas(sheets, supabase, configs, allowStructural, invocationId)
    summary.accessoryBodegas = await syncAccessoriesForBodegas(sheets, supabase, configs, allowStructural, invocationId)
  } finally {
    await releaseLock(supabase)
  }

  summary.durationMs = Date.now() - startedAt
  return summary
}
