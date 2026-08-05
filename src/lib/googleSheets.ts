import { google, sheets_v4 } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

// Layout de columnas (0-indexado) que usan todas las pestañas de sync.
// A-F son visibles, G-I son ocultas y solo las usa el sync.
export const COL = {
  FORMATO: 0,
  DESCRIPCION: 1,
  PIEZAS_X_CAJA: 2,
  M2_X_CAJA: 3,
  CAJAS_EN_EXISTENCIA: 4,
  PRECIO: 5,
  PRODUCT_ID: 6,
  LAST_SYNCED_NAME: 7,
  LAST_SYNCED_PRICE: 8,
} as const

export const HEADERS = [
  'FORMATO', 'DESCRIPCIÓN', 'PIEZAS X CAJA', 'M² X CAJA', 'CAJAS EN EXISTENCIA', 'PRECIO',
  '_product_id', '_last_synced_name', '_last_synced_price',
]

const DATA_LAST_ROW = 5000

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!email || !rawKey) {
    throw new Error('Google Sheets sync no configurado: faltan GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
  }
  return new google.auth.JWT({ email, key: rawKey.replace(/\\n/g, '\n'), scopes: SCOPES })
}

let cachedClient: sheets_v4.Sheets | null = null

export function getSheetsClient(): sheets_v4.Sheets {
  if (!cachedClient) cachedClient = google.sheets({ version: 'v4', auth: getAuth() })
  return cachedClient
}

function quoteTitle(title: string) {
  return `'${title.replace(/'/g, "''")}'`
}

export function colLetter(index0: number): string {
  return String.fromCharCode(65 + index0)
}

export function cellRange(title: string, col0: number, row1: number): string {
  return `${quoteTitle(title)}!${colLetter(col0)}${row1}`
}

export function rowRange(title: string, startRow1: number, endRow1: number): string {
  return `${quoteTitle(title)}!A${startRow1}:${colLetter(COL.LAST_SYNCED_PRICE)}${endRow1}`
}

export interface TabInfo { sheetId: number; title: string }

export async function listTabs(sheets: sheets_v4.Sheets, spreadsheetId: string): Promise<TabInfo[]> {
  const res = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets(properties(sheetId,title))' })
  return (res.data.sheets || [])
    .filter(s => s.properties?.sheetId != null && s.properties?.title)
    .map(s => ({ sheetId: s.properties!.sheetId!, title: s.properties!.title! }))
}

export type CellValue = string | number | boolean

// Lee todas las filas (incluyendo header) de cada pestaña pedida, en una sola llamada.
// UNFORMATTED_VALUE es crítico: sin esto, Sheets devuelve los números ya
// formateados según el locale de la hoja (ej. "735,06" con coma decimal), lo
// cual rompe la comparación numérica del sync de forma silenciosa y permanente.
export async function batchGetTabValues(sheets: sheets_v4.Sheets, spreadsheetId: string, titles: string[]): Promise<Map<string, CellValue[][]>> {
  const result = new Map<string, CellValue[][]>()
  if (titles.length === 0) return result
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: titles.map(t => rowRange(t, 1, DATA_LAST_ROW)),
    valueRenderOption: 'UNFORMATTED_VALUE',
  })
  ;(res.data.valueRanges || []).forEach((vr, i) => {
    result.set(titles[i], (vr.values as CellValue[][]) || [])
  })
  return result
}

export async function batchWriteCells(sheets: sheets_v4.Sheets, spreadsheetId: string, writes: { range: string; values: (string | number)[][] }[]): Promise<void> {
  if (writes.length === 0) return
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'RAW', data: writes.map(w => ({ range: w.range, values: w.values })) },
  })
}

// Borra todas las filas de datos (fila 2 en adelante) de varias pestañas en una sola llamada.
export async function batchClearTabs(sheets: sheets_v4.Sheets, spreadsheetId: string, titles: string[]): Promise<void> {
  if (titles.length === 0) return
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId,
    requestBody: { ranges: titles.map(t => rowRange(t, 2, DATA_LAST_ROW)) },
  })
}

export async function applyStructuralRequests(sheets: sheets_v4.Sheets, spreadsheetId: string, requests: sheets_v4.Schema$Request[]): Promise<sheets_v4.Schema$Response[]> {
  if (requests.length === 0) return []
  const res = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
  return res.data.replies || []
}

// Crea las pestañas faltantes en una sola llamada y regresa título -> sheetId real
// (el id real solo se conoce en la respuesta, no se puede predecir de antemano).
export async function createMissingTabs(sheets: sheets_v4.Sheets, spreadsheetId: string, titles: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (titles.length === 0) return map
  const requests: sheets_v4.Schema$Request[] = titles.map(title => ({ addSheet: { properties: { title } } }))
  const replies = await applyStructuralRequests(sheets, spreadsheetId, requests)
  replies.forEach((r, i) => {
    const sheetId = r.addSheet?.properties?.sheetId
    if (sheetId != null) map.set(titles[i], sheetId)
  })
  return map
}

// Protege FORMATO, PIEZAS X CAJA/M² X CAJA y las columnas ocultas de sync —
// solo la cuenta de servicio (y el dueño del archivo, siempre implícito) puede
// editarlas. DESCRIPCIÓN/CAJAS EN EXISTENCIA/PRECIO quedan libres para el personal.
export function buildProtectionRequests(sheetId: number, serviceAccountEmail: string): sheets_v4.Schema$Request[] {
  const editors = { users: [serviceAccountEmail] }
  return [
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startColumnIndex: COL.FORMATO, endColumnIndex: COL.FORMATO + 1 },
      description: 'FORMATO - solo lectura', warningOnly: false, editors,
    } } },
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startColumnIndex: COL.PIEZAS_X_CAJA, endColumnIndex: COL.M2_X_CAJA + 1 },
      description: 'PIEZAS/M2 - solo lectura', warningOnly: false, editors,
    } } },
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startColumnIndex: COL.PRODUCT_ID, endColumnIndex: COL.LAST_SYNCED_PRICE + 1 },
      description: 'Columnas internas de sincronización - no editar', warningOnly: false, editors,
    } } },
  ]
}

export function buildHideColumnsRequest(sheetId: number): sheets_v4.Schema$Request {
  return { updateDimensionProperties: {
    range: { sheetId, dimension: 'COLUMNS', startIndex: COL.PRODUCT_ID, endIndex: COL.LAST_SYNCED_PRICE + 1 },
    properties: { hiddenByUser: true },
    fields: 'hiddenByUser',
  } }
}

export function buildFreezeHeaderRequest(sheetId: number): sheets_v4.Schema$Request {
  return { updateSheetProperties: {
    properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
    fields: 'gridProperties.frozenRowCount',
  } }
}

// Quita cualquier combinación de celdas existente en la columna FORMATO antes
// de reconstruir una pestaña (evita error "celdas ya combinadas" al re-combinar).
export function buildUnmergeRequest(sheetId: number): sheets_v4.Schema$Request {
  return { unmergeCells: { range: { sheetId, startColumnIndex: COL.FORMATO, endColumnIndex: COL.FORMATO + 1 } } }
}

export function buildMergeRequest(sheetId: number, startRow0: number, endRow0: number): sheets_v4.Schema$Request {
  return { mergeCells: {
    range: { sheetId, startRowIndex: startRow0, endRowIndex: endRow0, startColumnIndex: COL.FORMATO, endColumnIndex: COL.FORMATO + 1 },
    mergeType: 'MERGE_ALL',
  } }
}

// -------- Formato visual (mismos colores que el export a Excel) --------

const COLORS = {
  headerBg: 'D9E2F3',
  headerText: '1E293B',
  zeroBg: 'F8D7DA',
  border: 'B0B8C1',
}

function hexToRgb(hex: string) {
  return {
    red: parseInt(hex.slice(0, 2), 16) / 255,
    green: parseInt(hex.slice(2, 4), 16) / 255,
    blue: parseInt(hex.slice(4, 6), 16) / 255,
  }
}

const VISIBLE_COLS = { startColumnIndex: COL.FORMATO, endColumnIndex: COL.PRECIO + 1 }
const STYLE_LAST_ROW = 1000 // suficiente margen sobre el tamaño real de cualquier marca

// Encabezado en negrita con fondo de color — idempotente, se puede reaplicar cada corrida.
export function buildHeaderStyleRequest(sheetId: number): sheets_v4.Schema$Request {
  return { repeatCell: {
    range: { sheetId, startRowIndex: 0, endRowIndex: 1, ...VISIBLE_COLS },
    cell: { userEnteredFormat: {
      backgroundColor: hexToRgb(COLORS.headerBg),
      textFormat: { bold: true, foregroundColor: hexToRgb(COLORS.headerText) },
      horizontalAlignment: 'CENTER',
      verticalAlignment: 'MIDDLE',
    } },
    fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
  } }
}

// Formato numérico para M² X CAJA y moneda para PRECIO — idempotente.
export function buildNumberFormatRequests(sheetId: number): sheets_v4.Schema$Request[] {
  return [
    { repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: COL.M2_X_CAJA, endColumnIndex: COL.M2_X_CAJA + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0.00' } } },
      fields: 'userEnteredFormat.numberFormat',
    } },
    { repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: COL.PRECIO, endColumnIndex: COL.PRECIO + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: '"$"#,##0.00' } } },
      fields: 'userEnteredFormat.numberFormat',
    } },
    { repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: COL.FORMATO, endColumnIndex: COL.FORMATO + 1 },
      cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
      fields: 'userEnteredFormat.horizontalAlignment',
    } },
  ]
}

// Bordes delgados alrededor de toda la tabla (encabezado + filas) — idempotente.
export function buildBorderRequest(sheetId: number): sheets_v4.Schema$Request {
  const style = { style: 'SOLID' as const, color: hexToRgb(COLORS.border) }
  return { updateBorders: {
    range: { sheetId, startRowIndex: 0, endRowIndex: STYLE_LAST_ROW, ...VISIBLE_COLS },
    top: style, bottom: style, left: style, right: style, innerHorizontal: style, innerVertical: style,
  } }
}

// Filtro (como el autoFilter de Excel) — idempotente, un solo filtro por pestaña.
export function buildFilterRequest(sheetId: number): sheets_v4.Schema$Request {
  return { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, endRowIndex: STYLE_LAST_ROW, ...VISIBLE_COLS } } } }
}

// Anchos de columna razonables — idempotente.
export function buildColumnWidthRequests(sheetId: number): sheets_v4.Schema$Request[] {
  const widths: [number, number][] = [
    [COL.FORMATO, 80], [COL.DESCRIPCION, 240], [COL.PIEZAS_X_CAJA, 100],
    [COL.M2_X_CAJA, 90], [COL.CAJAS_EN_EXISTENCIA, 150], [COL.PRECIO, 100],
  ]
  return widths.map(([index, pixelSize]) => ({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: index, endIndex: index + 1 },
      properties: { pixelSize },
      fields: 'pixelSize',
    },
  }))
}

// Resalta en rojo claro las filas con "CAJAS EN EXISTENCIA" = 0 — es una regla
// de formato condicional (no un color fijo por celda), así que se actualiza
// sola cuando cambia el stock sin que el sync tenga que reescribirla. Solo se
// agrega una vez por pestaña (agregarla de nuevo crearía reglas duplicadas).
export function buildZeroStockHighlightRequest(sheetId: number): sheets_v4.Schema$Request {
  return { addConditionalFormatRule: {
    rule: {
      ranges: [{ sheetId, startRowIndex: 1, endRowIndex: STYLE_LAST_ROW, ...VISIBLE_COLS }],
      booleanRule: {
        // En Sheets una celda vacía cuenta como 0, así que sin el chequeo de
        // que la fila tenga un _product_id real, TODAS las filas vacías de
        // abajo (hasta STYLE_LAST_ROW) también se pintarían de rojo. Usa ";"
        // como separador de argumentos (no ",") porque las hojas están en
        // locale español, donde AND(a,b) con coma no es válido.
        condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: `=AND($${colLetter(COL.PRODUCT_ID)}2<>"";$${colLetter(COL.CAJAS_EN_EXISTENCIA)}2=0)` }] },
        format: { backgroundColor: hexToRgb(COLORS.zeroBg) },
      },
    },
    index: 0,
  } }
}

// Todo el formato "idempotente" (seguro de reaplicar en cada corrida, ya que
// solo sobreescribe valores en vez de acumular — a diferencia de las reglas de
// protección o condicionales, que si se duplicarían).
export function buildRepeatableStyleRequests(sheetId: number): sheets_v4.Schema$Request[] {
  return [
    buildHeaderStyleRequest(sheetId),
    ...buildNumberFormatRequests(sheetId),
    buildBorderRequest(sheetId),
    buildFilterRequest(sheetId),
    ...buildColumnWidthRequests(sheetId),
  ]
}
