import { google, sheets_v4 } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

// Layout de columnas (0-indexado) que usan todas las pestañas de sync.
// A-G son visibles, H-J son ocultas y solo las usa el sync.
export const COL = {
  FORMATO: 0,
  SKU: 1,
  DESCRIPCION: 2,
  PIEZAS_X_CAJA: 3,
  M2_X_CAJA: 4,
  CAJAS_EN_EXISTENCIA: 5,
  PRECIO: 6,
  PRODUCT_ID: 7,
  LAST_SYNCED_NAME: 8,
  LAST_SYNCED_PRICE: 9,
} as const

export const HEADERS = [
  'FORMATO', 'SKU', 'DESCRIPCIÓN', 'PIEZAS X CAJA', 'M² X CAJA', 'CAJAS EN EXISTENCIA', 'PRECIO',
  '_product_id', '_last_synced_name', '_last_synced_price',
]

const DATA_LAST_ROW = 5000

// Rango genérico usado por batchGetTabValues/batchClearTabs para leer/borrar
// pestañas SIN importar su layout específico (Pisos/Mallas/Adhesivos tienen
// distinto número de columnas ocultas al final). Debe ser siempre igual o más
// ancho que la columna oculta más a la derecha de cualquier layout — usar la
// columna de un layout específico aquí (como se hacía antes con rowRange(),
// pensado solo para Pisos) corta las columnas ocultas de los demás layouts si
// son más anchos, hasta el punto de que _last_synced_price nunca se llegaba a
// leer para Mallas y esa fila se trataba como "recién editada" en cada corrida.
const SYNC_FETCH_LAST_COL = 25 // columna Z — margen amplio sobre cualquier layout actual
function fullRowRange(title: string, startRow1: number, endRow1: number): string {
  return `${quoteTitle(title)}!A${startRow1}:${colLetter(SYNC_FETCH_LAST_COL)}${endRow1}`
}

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!email || !rawKey) {
    throw new Error('Google Sheets sync no configurado: faltan GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
  }
  return new google.auth.JWT({ email, key: rawKey.replace(/\\n/g, '\n'), scopes: SCOPES })
}

// Deliberadamente SIN cachear a nivel de módulo. En una función serverless de
// Vercel, una variable a nivel de módulo puede sobrevivir y compartirse entre
// invocaciones distintas de un mismo contenedor "caliente" (más aún con Fluid
// Compute, donde varias invocaciones concurrentes literalmente comparten el
// mismo scope de módulo) — eso incluye el cliente HTTP subyacente y su pool de
// conexiones. Ese fue el sospechoso principal de que, en producción (nunca en
// pruebas locales, donde un proceso nunca tiene una "segunda vida"), contenido
// de una bodega apareciera escrito en el archivo de otra. Crear el cliente
// fresco en cada llamada cuesta poco (no hace una llamada de red hasta el
// primer uso real) y elimina ese vector por completo.
export function getSheetsClient(): sheets_v4.Sheets {
  return google.sheets({ version: 'v4', auth: getAuth() })
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
    ranges: titles.map(t => fullRowRange(t, 1, DATA_LAST_ROW)),
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
    requestBody: { ranges: titles.map(t => fullRowRange(t, 2, DATA_LAST_ROW)) },
  })
}

export async function applyStructuralRequests(sheets: sheets_v4.Sheets, spreadsheetId: string, requests: sheets_v4.Schema$Request[]): Promise<sheets_v4.Schema$Response[]> {
  if (requests.length === 0) return []
  const res = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
  return res.data.replies || []
}

// Las protecciones (addProtectedRange) y las reglas de formato condicional
// (addConditionalFormatRule) NO son idempotentes — llamarlas de nuevo apila
// reglas duplicadas en vez de reemplazar las existentes. Por eso solo se
// agregaban una vez, al crear la pestaña. Pero cuando el LAYOUT de columnas
// cambia (ej. se inserta una columna nueva) o se reconstruye una pestaña ya
// existente, las protecciones viejas quedan protegiendo las columnas
// EQUIVOCADAS (las que antes eran otra cosa) — hay que borrarlas primero.
export async function getSheetProtectionState(sheets: sheets_v4.Sheets, spreadsheetId: string, sheetId: number): Promise<{ protectedRangeIds: number[]; conditionalFormatCount: number }> {
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId),protectedRanges(protectedRangeId),conditionalFormats)',
  })
  const sheet = (res.data.sheets || []).find(s => s.properties?.sheetId === sheetId)
  return {
    protectedRangeIds: (sheet?.protectedRanges || []).map(p => p.protectedRangeId).filter((id): id is number => id != null),
    conditionalFormatCount: (sheet?.conditionalFormats || []).length,
  }
}

export function buildClearProtectionsAndFormatsRequests(sheetId: number, protectedRangeIds: number[], conditionalFormatCount: number): sheets_v4.Schema$Request[] {
  return [
    ...protectedRangeIds.map(id => ({ deleteProtectedRange: { protectedRangeId: id } })),
    // Al borrar la regla en el índice 0, la siguiente pasa a ocupar ese mismo
    // índice — repetir "borra el índice 0" N veces borra las N reglas.
    ...Array.from({ length: conditionalFormatCount }, () => ({ deleteConditionalFormatRule: { sheetId, index: 0 } })),
  ]
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

// Protege FORMATO/SKU, PIEZAS X CAJA/M² X CAJA, PRECIO, la fila de encabezados
// y las columnas ocultas de sync — solo la cuenta de servicio (y el dueño del
// archivo, siempre implícito) puede editarlas. Solo DESCRIPCIÓN/CAJAS EN
// EXISTENCIA quedan libres para el personal.
export function buildProtectionRequests(sheetId: number, serviceAccountEmail: string): sheets_v4.Schema$Request[] {
  const editors = { users: [serviceAccountEmail] }
  return [
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startColumnIndex: COL.FORMATO, endColumnIndex: COL.SKU + 1 },
      description: 'FORMATO/SKU - solo lectura', warningOnly: false, editors,
    } } },
    { addProtectedRange: { protectedRange: {
      // D:E — PIEZAS X CAJA / M² X CAJA. OJO: no se puede fusionar con el
      // rango de PRECIO (G) porque entre medio está CAJAS EN EXISTENCIA (F),
      // que debe quedar editable — necesitan ser 2 rangos separados.
      range: { sheetId, startColumnIndex: COL.PIEZAS_X_CAJA, endColumnIndex: COL.M2_X_CAJA + 1 },
      description: 'PIEZAS/M2 - solo lectura', warningOnly: false, editors,
    } } },
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startColumnIndex: COL.PRECIO, endColumnIndex: COL.PRECIO + 1 },
      description: 'PRECIO - solo lectura', warningOnly: false, editors,
    } } },
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startColumnIndex: COL.PRODUCT_ID, endColumnIndex: COL.LAST_SYNCED_PRICE + 1 },
      description: 'Columnas internas de sincronización - no editar', warningOnly: false, editors,
    } } },
    { addProtectedRange: { protectedRange: {
      // Fila de encabezados completa (incl. DESCRIPCIÓN/CAJAS EN EXISTENCIA,
      // que sí quedan editables en las filas de datos) — el personal solo
      // debería poder escribir sus valores, no renombrar las columnas.
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: COL.FORMATO, endColumnIndex: COL.PRECIO + 1 },
      description: 'Encabezados - solo lectura', warningOnly: false, editors,
    } } },
    // Protección de la PESTAÑA completa (range sin límites = toda la hoja) —
    // a diferencia de las protecciones de arriba (que solo bloquean editar
    // celdas puntuales), esta también evita que alguien sin permiso borre,
    // renombre o mueva la pestaña. unprotectedRanges dentro de esta misma
    // protección deja libres exactamente las mismas celdas de siempre.
    { addProtectedRange: { protectedRange: {
      range: { sheetId },
      unprotectedRanges: [
        { sheetId, startRowIndex: 1, startColumnIndex: COL.DESCRIPCION, endColumnIndex: COL.DESCRIPCION + 1 },
        { sheetId, startRowIndex: 1, startColumnIndex: COL.CAJAS_EN_EXISTENCIA, endColumnIndex: COL.CAJAS_EN_EXISTENCIA + 1 },
      ],
      description: 'Pestaña protegida - no borrar/renombrar', warningOnly: false, editors,
    } } },
  ]
}

// Devuelve 2 requests: ocultar las columnas internas Y des-ocultar
// explícitamente las visibles. Sin el segundo, si el layout cambia (ej. se
// inserta una columna nueva) una columna que antes caía en el rango oculto
// puede terminar coincidiendo con una columna visible del nuevo layout — la
// bandera "oculta" es una propiedad de la posición física de la columna, no
// se limpia sola solo porque el significado de esa columna cambió.
export function buildHideColumnsRequest(sheetId: number): sheets_v4.Schema$Request[] {
  return [
    { updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: COL.FORMATO, endIndex: COL.PRODUCT_ID },
      properties: { hiddenByUser: false },
      fields: 'hiddenByUser',
    } },
    { updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: COL.PRODUCT_ID, endIndex: COL.LAST_SYNCED_PRICE + 1 },
      properties: { hiddenByUser: true },
      fields: 'hiddenByUser',
    } },
  ]
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
      // Encabezados largos (ej. "CAJAS EN EXISTENCIA") no caben en columnas
      // angostas pensadas para el dato, no para el título — en vez de
      // ensanchar cada columna al ancho del título más largo, se envuelve en
      // 2 líneas dentro de la misma celda.
      wrapStrategy: 'WRAP',
    } },
    fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)',
  } }
}

// Encabezados envueltos en 2 líneas necesitan más alto que la fila por
// defecto (~21px) para no verse cortados — aplica a cualquier tipo de hoja.
export function buildHeaderRowHeightRequest(sheetId: number): sheets_v4.Schema$Request {
  return { updateDimensionProperties: {
    range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
    properties: { pixelSize: 42 },
    fields: 'pixelSize',
  } }
}

// Formato numérico para M² X CAJA y moneda para PRECIO — idempotente.
export function buildNumberFormatRequests(sheetId: number): sheets_v4.Schema$Request[] {
  return [
    { repeatCell: {
      // Explícito en NUMBER plano para pisar cualquier formato decimal
      // heredado de cuando esta posición física de columna solía ser
      // M² X CAJA (antes de insertar SKU) — PIEZAS X CAJA es entero.
      range: { sheetId, startRowIndex: 1, startColumnIndex: COL.PIEZAS_X_CAJA, endColumnIndex: COL.PIEZAS_X_CAJA + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0' } } },
      fields: 'userEnteredFormat.numberFormat',
    } },
    { repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: COL.M2_X_CAJA, endColumnIndex: COL.M2_X_CAJA + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0.00' } } },
      fields: 'userEnteredFormat.numberFormat',
    } },
    { repeatCell: {
      // Explícito en NUMBER (no solo "no tocar") para pisar cualquier formato
      // de moneda que haya quedado pegado de un layout anterior, cuando esta
      // posición física de columna solía ser PRECIO antes de insertar SKU.
      range: { sheetId, startRowIndex: 1, startColumnIndex: COL.CAJAS_EN_EXISTENCIA, endColumnIndex: COL.CAJAS_EN_EXISTENCIA + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0' } } },
      fields: 'userEnteredFormat.numberFormat',
    } },
    { repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: COL.PRECIO, endColumnIndex: COL.PRECIO + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '"$"#,##0.##' } } },
      fields: 'userEnteredFormat.numberFormat',
    } },
    { repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: COL.FORMATO, endColumnIndex: COL.SKU + 1 },
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
    [COL.FORMATO, 80], [COL.SKU, 110], [COL.DESCRIPCION, 240], [COL.PIEZAS_X_CAJA, 100],
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
// Empieza en SKU (no en FORMATO): FORMATO se fusiona en una sola celda por
// grupo de medida, y Sheets solo pinta con el color de la celda superior
// izquierda de la fusión — si esa primera fila del grupo tiene 0 cajas pero
// otras filas del mismo formato sí tienen stock, la celda fusionada del
// formato se veía roja igual, dando a entender que TODO el formato estaba
// agotado cuando solo era una fila.
const ZERO_STOCK_HIGHLIGHT_COLS = { startColumnIndex: COL.SKU, endColumnIndex: COL.PRECIO + 1 }

export function buildZeroStockHighlightRequest(sheetId: number): sheets_v4.Schema$Request {
  return { addConditionalFormatRule: {
    rule: {
      ranges: [{ sheetId, startRowIndex: 1, endRowIndex: STYLE_LAST_ROW, ...ZERO_STOCK_HIGHLIGHT_COLS }],
      booleanRule: {
        // En Sheets una celda vacía cuenta como 0, así que sin el chequeo de
        // que la fila tenga un _product_id real, TODAS las filas vacías de
        // abajo (hasta STYLE_LAST_ROW) también se pintarían de rojo. El
        // separador de argumentos depende del locale del archivo (es_MX usa
        // punto decimal, así que la coma SÍ es válida como separador aquí —
        // a diferencia de cuando el archivo estaba en es_ES).
        condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: `=AND($${colLetter(COL.PRODUCT_ID)}2<>"",$${colLetter(COL.CAJAS_EN_EXISTENCIA)}2=0)` }] },
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
    buildHeaderRowHeightRequest(sheetId),
    ...buildNumberFormatRequests(sheetId),
    buildBorderRequest(sheetId),
    buildFilterRequest(sheetId),
    ...buildColumnWidthRequests(sheetId),
  ]
}

// ==================== Adhesivos (pestaña plana, sin agrupar por marca) ====================
// Layout propio y más simple que el de Pisos (COL/HEADERS arriba) — sin
// FORMATO/PIEZAS/M², que no aplican a adhesivos/boquillas. Coincide con el
// nivel de detalle que ya usa el export a Excel de "Adhesivos".
//
// A diferencia de Pisos/Mallas, aquí solo CANTIDAD queda editable para el
// personal — ni siquiera la descripción. CATEGORÍA se agrupa en 2 bloques
// grandes fusionados (Adhesivo/Boquilla), mismo patrón visual que FORMATO en
// Pisos — reclasificar un producto se sigue haciendo desde la app.

export const COL_ACC = {
  CATEGORIA: 0,
  MARCA: 1,
  SKU: 2,
  DESCRIPCION: 3,
  CANTIDAD: 4,
  PRECIO: 5,
  ACCESSORY_ID: 6,
  LAST_SYNCED_NAME: 7,
  LAST_SYNCED_PRICE: 8,
  // Solo para detectar que la categoría de un accesorio cambió desde la app
  // (CATEGORÍA está protegida/fusionada, no se lee de vuelta como cambio de
  // staff) — dispara una reconstrucción completa para que la fila se mueva
  // al bloque fusionado correcto.
  LAST_SYNCED_CATEGORY: 9,
} as const

export const HEADERS_ACC = [
  'CATEGORÍA', 'MARCA', 'SKU', 'DESCRIPCIÓN', 'CANTIDAD', 'PRECIO',
  '_accessory_id', '_last_synced_name', '_last_synced_price', '_last_synced_category',
]

export const ACCESSORY_TAB_NAME = 'Adhesivos'

// Gemelo de rowRange() para el layout de Adhesivos — rowRange() hardcodea la
// columna final en COL.LAST_SYNCED_PRICE (propia de Pisos, columna I).
export function rowRangeAcc(title: string, startRow1: number, endRow1: number): string {
  return `${quoteTitle(title)}!A${startRow1}:${colLetter(COL_ACC.LAST_SYNCED_CATEGORY)}${endRow1}`
}

const VISIBLE_COLS_ACC = { startColumnIndex: COL_ACC.CATEGORIA, endColumnIndex: COL_ACC.PRECIO + 1 }

// Protege CATEGORÍA/SKU/DESCRIPCIÓN y PRECIO — solo CANTIDAD queda libre
// para el personal.
export function buildAccessoryProtectionRequests(sheetId: number, serviceAccountEmail: string): sheets_v4.Schema$Request[] {
  const editors = { users: [serviceAccountEmail] }
  return [
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startColumnIndex: COL_ACC.CATEGORIA, endColumnIndex: COL_ACC.DESCRIPCION + 1 },
      description: 'CATEGORÍA/MARCA/SKU/DESCRIPCIÓN - solo lectura', warningOnly: false, editors,
    } } },
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startColumnIndex: COL_ACC.PRECIO, endColumnIndex: COL_ACC.PRECIO + 1 },
      description: 'PRECIO - solo lectura', warningOnly: false, editors,
    } } },
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startColumnIndex: COL_ACC.ACCESSORY_ID, endColumnIndex: COL_ACC.LAST_SYNCED_CATEGORY + 1 },
      description: 'Columnas internas de sincronización - no editar', warningOnly: false, editors,
    } } },
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: COL_ACC.CATEGORIA, endColumnIndex: COL_ACC.PRECIO + 1 },
      description: 'Encabezados - solo lectura', warningOnly: false, editors,
    } } },
    // Protección de la PESTAÑA completa — ver el equivalente de Pisos
    // (buildProtectionRequests). Aquí solo CANTIDAD queda libre, ni siquiera
    // DESCRIPCIÓN (decisión explícita: en Adhesivos solo se reporta cantidad).
    { addProtectedRange: { protectedRange: {
      range: { sheetId },
      unprotectedRanges: [
        { sheetId, startRowIndex: 1, startColumnIndex: COL_ACC.CANTIDAD, endColumnIndex: COL_ACC.CANTIDAD + 1 },
      ],
      description: 'Pestaña protegida - no borrar/renombrar', warningOnly: false, editors,
    } } },
  ]
}

// Quita/rehace la combinación de celdas de CATEGORÍA — mismo patrón que
// buildUnmergeRequest/buildMergeRequest para FORMATO en Pisos.
export function buildAccessoryUnmergeRequest(sheetId: number): sheets_v4.Schema$Request {
  return { unmergeCells: { range: { sheetId, startColumnIndex: COL_ACC.CATEGORIA, endColumnIndex: COL_ACC.CATEGORIA + 1 } } }
}

export function buildAccessoryMergeRequest(sheetId: number, startRow0: number, endRow0: number): sheets_v4.Schema$Request {
  return { mergeCells: {
    range: { sheetId, startRowIndex: startRow0, endRowIndex: endRow0, startColumnIndex: COL_ACC.CATEGORIA, endColumnIndex: COL_ACC.CATEGORIA + 1 },
    mergeType: 'MERGE_ALL',
  } }
}

export function buildAccessoryHideColumnsRequest(sheetId: number): sheets_v4.Schema$Request[] {
  return [
    { updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: COL_ACC.CATEGORIA, endIndex: COL_ACC.ACCESSORY_ID },
      properties: { hiddenByUser: false },
      fields: 'hiddenByUser',
    } },
    { updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: COL_ACC.ACCESSORY_ID, endIndex: COL_ACC.LAST_SYNCED_CATEGORY + 1 },
      properties: { hiddenByUser: true },
      fields: 'hiddenByUser',
    } },
  ]
}

export function buildAccessoryZeroStockHighlightRequest(sheetId: number): sheets_v4.Schema$Request {
  return { addConditionalFormatRule: {
    rule: {
      // OJO: arranca en MARCA, no en CATEGORÍA — CATEGORÍA está fusionada en
      // bloques grandes (Adhesivo/Boquilla) y una fórmula por-fila no se
      // puede pintar de forma sensata ahí: si UNA fila del bloque tiene stock
      // en 0, pintaría el bloque entero de rojo aunque el resto sí tenga stock.
      // MARCA sí es una celda normal por fila (no fusionada), así que puede
      // entrar en el rango igual que SKU/DESCRIPCIÓN/PRECIO.
      ranges: [{ sheetId, startRowIndex: 1, endRowIndex: STYLE_LAST_ROW, startColumnIndex: COL_ACC.MARCA, endColumnIndex: COL_ACC.PRECIO + 1 }],
      booleanRule: {
        condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: `=AND($${colLetter(COL_ACC.ACCESSORY_ID)}2<>"",$${colLetter(COL_ACC.CANTIDAD)}2=0)` }] },
        format: { backgroundColor: hexToRgb(COLORS.zeroBg) },
      },
    },
    index: 0,
  } }
}

export function buildAccessoryRepeatableStyleRequests(sheetId: number): sheets_v4.Schema$Request[] {
  const style = { style: 'SOLID' as const, color: hexToRgb(COLORS.border) }
  return [
    { repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, ...VISIBLE_COLS_ACC },
      cell: { userEnteredFormat: {
        backgroundColor: hexToRgb(COLORS.headerBg),
        textFormat: { bold: true, foregroundColor: hexToRgb(COLORS.headerText) },
        horizontalAlignment: 'CENTER',
        verticalAlignment: 'MIDDLE',
        wrapStrategy: 'WRAP',
      } },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)',
    } },
    buildHeaderRowHeightRequest(sheetId),
    { repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: COL_ACC.PRECIO, endColumnIndex: COL_ACC.PRECIO + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '"$"#,##0.##' } } },
      fields: 'userEnteredFormat.numberFormat',
    } },
    { repeatCell: {
      // Explícito en NUMBER para pisar cualquier formato de moneda heredado
      // de cuando esta columna física solía ser PRECIO (antes de insertar SKU).
      range: { sheetId, startRowIndex: 1, startColumnIndex: COL_ACC.CANTIDAD, endColumnIndex: COL_ACC.CANTIDAD + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0' } } },
      fields: 'userEnteredFormat.numberFormat',
    } },
    { repeatCell: {
      // Igual que FORMATO en Pisos: centrado, para que se vea bien como
      // bloque grande fusionado (Adhesivo/Boquilla).
      range: { sheetId, startRowIndex: 1, startColumnIndex: COL_ACC.CATEGORIA, endColumnIndex: COL_ACC.CATEGORIA + 1 },
      cell: { userEnteredFormat: { horizontalAlignment: 'CENTER', textFormat: { bold: true } } },
      fields: 'userEnteredFormat(horizontalAlignment,textFormat)',
    } },
    { updateBorders: {
      range: { sheetId, startRowIndex: 0, endRowIndex: STYLE_LAST_ROW, ...VISIBLE_COLS_ACC },
      top: style, bottom: style, left: style, right: style, innerHorizontal: style, innerVertical: style,
    } },
    { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, endRowIndex: STYLE_LAST_ROW, ...VISIBLE_COLS_ACC } } } },
    { updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: COL_ACC.CATEGORIA, endIndex: COL_ACC.CATEGORIA + 1 },
      properties: { pixelSize: 130 },
      fields: 'pixelSize',
    } },
    { updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: COL_ACC.MARCA, endIndex: COL_ACC.MARCA + 1 },
      properties: { pixelSize: 110 },
      fields: 'pixelSize',
    } },
    { updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: COL_ACC.SKU, endIndex: COL_ACC.SKU + 1 },
      properties: { pixelSize: 110 },
      fields: 'pixelSize',
    } },
    { updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: COL_ACC.DESCRIPCION, endIndex: COL_ACC.DESCRIPCION + 1 },
      properties: { pixelSize: 240 },
      fields: 'pixelSize',
    } },
    { updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: COL_ACC.CANTIDAD, endIndex: COL_ACC.CANTIDAD + 1 },
      properties: { pixelSize: 130 },
      fields: 'pixelSize',
    } },
    { updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: COL_ACC.PRECIO, endIndex: COL_ACC.PRECIO + 1 },
      properties: { pixelSize: 100 },
      fields: 'pixelSize',
    } },
  ]
}

// ==================== Mallas (pestaña plana, sin agrupar por marca) ====================
// Mismos campos que Pisos (formato, piezas/caja, m²/caja, precio) salvo que
// aquí no hay una pestaña por marca — como el catálogo de mallas es chico,
// va todo en una sola pestaña plana (igual que Adhesivos), agregando una
// columna MARCA visible ya que no hay pestaña que la reemplace.

export const COL_MESH = {
  MARCA: 0,
  FORMATO: 1,
  SKU: 2,
  DESCRIPCION: 3,
  PIEZAS_X_CAJA: 4,
  M2_X_CAJA: 5,
  CAJAS_EN_EXISTENCIA: 6,
  PRECIO: 7,
  MESH_ID: 8,
  LAST_SYNCED_NAME: 9,
  LAST_SYNCED_PRICE: 10,
} as const

export const HEADERS_MESH = [
  'MARCA', 'FORMATO', 'SKU', 'DESCRIPCIÓN', 'PIEZAS X CAJA', 'M² X CAJA', 'CAJAS EN EXISTENCIA', 'PRECIO',
  '_mesh_id', '_last_synced_name', '_last_synced_price',
]

export const MESH_TAB_NAME = 'Mallas'

// Gemelo de rowRange() para el layout de Mallas — rowRange() hardcodea la
// columna final en COL.LAST_SYNCED_PRICE (propia de Pisos, columna I).
export function rowRangeMesh(title: string, startRow1: number, endRow1: number): string {
  return `${quoteTitle(title)}!A${startRow1}:${colLetter(COL_MESH.LAST_SYNCED_PRICE)}${endRow1}`
}

const VISIBLE_COLS_MESH = { startColumnIndex: COL_MESH.MARCA, endColumnIndex: COL_MESH.PRECIO + 1 }

// Protege MARCA+FORMATO+SKU, PIEZAS/M2, PRECIO, la fila de encabezados y las
// columnas ocultas — solo DESCRIPCIÓN/CAJAS EN EXISTENCIA quedan libres para
// el personal (mismo criterio que Pisos).
export function buildMeshProtectionRequests(sheetId: number, serviceAccountEmail: string): sheets_v4.Schema$Request[] {
  const editors = { users: [serviceAccountEmail] }
  return [
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startColumnIndex: COL_MESH.MARCA, endColumnIndex: COL_MESH.SKU + 1 },
      description: 'MARCA/FORMATO/SKU - solo lectura', warningOnly: false, editors,
    } } },
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startColumnIndex: COL_MESH.PIEZAS_X_CAJA, endColumnIndex: COL_MESH.M2_X_CAJA + 1 },
      description: 'PIEZAS/M2 - solo lectura', warningOnly: false, editors,
    } } },
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startColumnIndex: COL_MESH.PRECIO, endColumnIndex: COL_MESH.PRECIO + 1 },
      description: 'PRECIO - solo lectura', warningOnly: false, editors,
    } } },
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startColumnIndex: COL_MESH.MESH_ID, endColumnIndex: COL_MESH.LAST_SYNCED_PRICE + 1 },
      description: 'Columnas internas de sincronización - no editar', warningOnly: false, editors,
    } } },
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: COL_MESH.MARCA, endColumnIndex: COL_MESH.PRECIO + 1 },
      description: 'Encabezados - solo lectura', warningOnly: false, editors,
    } } },
    // Protección de la PESTAÑA completa — ver el equivalente de Pisos
    // (buildProtectionRequests) para la explicación de por qué es distinta
    // de proteger solo celdas puntuales.
    { addProtectedRange: { protectedRange: {
      range: { sheetId },
      unprotectedRanges: [
        { sheetId, startRowIndex: 1, startColumnIndex: COL_MESH.DESCRIPCION, endColumnIndex: COL_MESH.DESCRIPCION + 1 },
        { sheetId, startRowIndex: 1, startColumnIndex: COL_MESH.CAJAS_EN_EXISTENCIA, endColumnIndex: COL_MESH.CAJAS_EN_EXISTENCIA + 1 },
      ],
      description: 'Pestaña protegida - no borrar/renombrar', warningOnly: false, editors,
    } } },
  ]
}

export function buildMeshHideColumnsRequest(sheetId: number): sheets_v4.Schema$Request[] {
  return [
    { updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: COL_MESH.MARCA, endIndex: COL_MESH.MESH_ID },
      properties: { hiddenByUser: false },
      fields: 'hiddenByUser',
    } },
    { updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: COL_MESH.MESH_ID, endIndex: COL_MESH.LAST_SYNCED_PRICE + 1 },
      properties: { hiddenByUser: true },
      fields: 'hiddenByUser',
    } },
  ]
}

export function buildMeshZeroStockHighlightRequest(sheetId: number): sheets_v4.Schema$Request {
  return { addConditionalFormatRule: {
    rule: {
      ranges: [{ sheetId, startRowIndex: 1, endRowIndex: STYLE_LAST_ROW, ...VISIBLE_COLS_MESH }],
      booleanRule: {
        condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: `=AND($${colLetter(COL_MESH.MESH_ID)}2<>"",$${colLetter(COL_MESH.CAJAS_EN_EXISTENCIA)}2=0)` }] },
        format: { backgroundColor: hexToRgb(COLORS.zeroBg) },
      },
    },
    index: 0,
  } }
}

export function buildMeshRepeatableStyleRequests(sheetId: number): sheets_v4.Schema$Request[] {
  const style = { style: 'SOLID' as const, color: hexToRgb(COLORS.border) }
  const widths: [number, number][] = [
    [COL_MESH.MARCA, 110], [COL_MESH.FORMATO, 80], [COL_MESH.SKU, 110], [COL_MESH.DESCRIPCION, 220],
    [COL_MESH.PIEZAS_X_CAJA, 100], [COL_MESH.M2_X_CAJA, 90], [COL_MESH.CAJAS_EN_EXISTENCIA, 150],
    [COL_MESH.PRECIO, 100],
  ]
  return [
    { repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, ...VISIBLE_COLS_MESH },
      cell: { userEnteredFormat: {
        backgroundColor: hexToRgb(COLORS.headerBg),
        textFormat: { bold: true, foregroundColor: hexToRgb(COLORS.headerText) },
        horizontalAlignment: 'CENTER',
        verticalAlignment: 'MIDDLE',
        wrapStrategy: 'WRAP',
      } },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)',
    } },
    buildHeaderRowHeightRequest(sheetId),
    { repeatCell: {
      // Explícito en NUMBER plano para pisar cualquier formato decimal
      // heredado de cuando esta posición física de columna solía ser
      // M² X CAJA (antes de insertar SKU) — PIEZAS X CAJA es entero.
      range: { sheetId, startRowIndex: 1, startColumnIndex: COL_MESH.PIEZAS_X_CAJA, endColumnIndex: COL_MESH.PIEZAS_X_CAJA + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0' } } },
      fields: 'userEnteredFormat.numberFormat',
    } },
    { repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: COL_MESH.M2_X_CAJA, endColumnIndex: COL_MESH.M2_X_CAJA + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0.00' } } },
      fields: 'userEnteredFormat.numberFormat',
    } },
    { repeatCell: {
      // Explícito en NUMBER para pisar cualquier formato de moneda heredado
      // de cuando esta columna física solía ser PRECIO (antes de insertar SKU).
      range: { sheetId, startRowIndex: 1, startColumnIndex: COL_MESH.CAJAS_EN_EXISTENCIA, endColumnIndex: COL_MESH.CAJAS_EN_EXISTENCIA + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0' } } },
      fields: 'userEnteredFormat.numberFormat',
    } },
    { repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: COL_MESH.PRECIO, endColumnIndex: COL_MESH.PRECIO + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '"$"#,##0.##' } } },
      fields: 'userEnteredFormat.numberFormat',
    } },
    { updateBorders: {
      range: { sheetId, startRowIndex: 0, endRowIndex: STYLE_LAST_ROW, ...VISIBLE_COLS_MESH },
      top: style, bottom: style, left: style, right: style, innerHorizontal: style, innerVertical: style,
    } },
    { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, endRowIndex: STYLE_LAST_ROW, ...VISIBLE_COLS_MESH } } } },
    ...widths.map(([index, pixelSize]) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS' as const, startIndex: index, endIndex: index + 1 },
        properties: { pixelSize },
        fields: 'pixelSize',
      },
    })),
  ]
}

// ==================== Cenefas (pestaña plana, sin agrupar por marca) ====================
// Mismo layout que Mallas — mismos campos que Pisos (formato, piezas/caja,
// m²/caja, precio) en una sola pestaña plana con columna MARCA visible.

export const COL_CENEFA = {
  MARCA: 0,
  FORMATO: 1,
  SKU: 2,
  DESCRIPCION: 3,
  PIEZAS_X_CAJA: 4,
  M2_X_CAJA: 5,
  CAJAS_EN_EXISTENCIA: 6,
  PRECIO: 7,
  CENEFA_ID: 8,
  LAST_SYNCED_NAME: 9,
  LAST_SYNCED_PRICE: 10,
} as const

export const HEADERS_CENEFA = [
  'MARCA', 'FORMATO', 'SKU', 'DESCRIPCIÓN', 'PIEZAS X CAJA', 'M² X CAJA', 'CAJAS EN EXISTENCIA', 'PRECIO',
  '_cenefa_id', '_last_synced_name', '_last_synced_price',
]

export const CENEFA_TAB_NAME = 'Cenefas'

export function rowRangeCenefa(title: string, startRow1: number, endRow1: number): string {
  return `${quoteTitle(title)}!A${startRow1}:${colLetter(COL_CENEFA.LAST_SYNCED_PRICE)}${endRow1}`
}

const VISIBLE_COLS_CENEFA = { startColumnIndex: COL_CENEFA.MARCA, endColumnIndex: COL_CENEFA.PRECIO + 1 }

// Protege MARCA+FORMATO+SKU, PIEZAS/M2, PRECIO, la fila de encabezados y las
// columnas ocultas — solo DESCRIPCIÓN/CAJAS EN EXISTENCIA quedan libres para
// el personal (mismo criterio que Pisos/Mallas).
export function buildCenefaProtectionRequests(sheetId: number, serviceAccountEmail: string): sheets_v4.Schema$Request[] {
  const editors = { users: [serviceAccountEmail] }
  return [
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startColumnIndex: COL_CENEFA.MARCA, endColumnIndex: COL_CENEFA.SKU + 1 },
      description: 'MARCA/FORMATO/SKU - solo lectura', warningOnly: false, editors,
    } } },
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startColumnIndex: COL_CENEFA.PIEZAS_X_CAJA, endColumnIndex: COL_CENEFA.M2_X_CAJA + 1 },
      description: 'PIEZAS/M2 - solo lectura', warningOnly: false, editors,
    } } },
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startColumnIndex: COL_CENEFA.PRECIO, endColumnIndex: COL_CENEFA.PRECIO + 1 },
      description: 'PRECIO - solo lectura', warningOnly: false, editors,
    } } },
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startColumnIndex: COL_CENEFA.CENEFA_ID, endColumnIndex: COL_CENEFA.LAST_SYNCED_PRICE + 1 },
      description: 'Columnas internas de sincronización - no editar', warningOnly: false, editors,
    } } },
    { addProtectedRange: { protectedRange: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: COL_CENEFA.MARCA, endColumnIndex: COL_CENEFA.PRECIO + 1 },
      description: 'Encabezados - solo lectura', warningOnly: false, editors,
    } } },
    // Protección de la PESTAÑA completa — ver el equivalente de Pisos
    // (buildProtectionRequests) para la explicación de por qué es distinta
    // de proteger solo celdas puntuales.
    { addProtectedRange: { protectedRange: {
      range: { sheetId },
      unprotectedRanges: [
        { sheetId, startRowIndex: 1, startColumnIndex: COL_CENEFA.DESCRIPCION, endColumnIndex: COL_CENEFA.DESCRIPCION + 1 },
        { sheetId, startRowIndex: 1, startColumnIndex: COL_CENEFA.CAJAS_EN_EXISTENCIA, endColumnIndex: COL_CENEFA.CAJAS_EN_EXISTENCIA + 1 },
      ],
      description: 'Pestaña protegida - no borrar/renombrar', warningOnly: false, editors,
    } } },
  ]
}

export function buildCenefaHideColumnsRequest(sheetId: number): sheets_v4.Schema$Request[] {
  return [
    { updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: COL_CENEFA.MARCA, endIndex: COL_CENEFA.CENEFA_ID },
      properties: { hiddenByUser: false },
      fields: 'hiddenByUser',
    } },
    { updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: COL_CENEFA.CENEFA_ID, endIndex: COL_CENEFA.LAST_SYNCED_PRICE + 1 },
      properties: { hiddenByUser: true },
      fields: 'hiddenByUser',
    } },
  ]
}

export function buildCenefaZeroStockHighlightRequest(sheetId: number): sheets_v4.Schema$Request {
  return { addConditionalFormatRule: {
    rule: {
      ranges: [{ sheetId, startRowIndex: 1, endRowIndex: STYLE_LAST_ROW, ...VISIBLE_COLS_CENEFA }],
      booleanRule: {
        condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: `=AND($${colLetter(COL_CENEFA.CENEFA_ID)}2<>"",$${colLetter(COL_CENEFA.CAJAS_EN_EXISTENCIA)}2=0)` }] },
        format: { backgroundColor: hexToRgb(COLORS.zeroBg) },
      },
    },
    index: 0,
  } }
}

export function buildCenefaRepeatableStyleRequests(sheetId: number): sheets_v4.Schema$Request[] {
  const style = { style: 'SOLID' as const, color: hexToRgb(COLORS.border) }
  const widths: [number, number][] = [
    [COL_CENEFA.MARCA, 110], [COL_CENEFA.FORMATO, 80], [COL_CENEFA.SKU, 110], [COL_CENEFA.DESCRIPCION, 220],
    [COL_CENEFA.PIEZAS_X_CAJA, 100], [COL_CENEFA.M2_X_CAJA, 90], [COL_CENEFA.CAJAS_EN_EXISTENCIA, 150],
    [COL_CENEFA.PRECIO, 100],
  ]
  return [
    { repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, ...VISIBLE_COLS_CENEFA },
      cell: { userEnteredFormat: {
        backgroundColor: hexToRgb(COLORS.headerBg),
        textFormat: { bold: true, foregroundColor: hexToRgb(COLORS.headerText) },
        horizontalAlignment: 'CENTER',
        verticalAlignment: 'MIDDLE',
        wrapStrategy: 'WRAP',
      } },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)',
    } },
    buildHeaderRowHeightRequest(sheetId),
    { repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: COL_CENEFA.PIEZAS_X_CAJA, endColumnIndex: COL_CENEFA.PIEZAS_X_CAJA + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0' } } },
      fields: 'userEnteredFormat.numberFormat',
    } },
    { repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: COL_CENEFA.M2_X_CAJA, endColumnIndex: COL_CENEFA.M2_X_CAJA + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0.00' } } },
      fields: 'userEnteredFormat.numberFormat',
    } },
    { repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: COL_CENEFA.CAJAS_EN_EXISTENCIA, endColumnIndex: COL_CENEFA.CAJAS_EN_EXISTENCIA + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0' } } },
      fields: 'userEnteredFormat.numberFormat',
    } },
    { repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: COL_CENEFA.PRECIO, endColumnIndex: COL_CENEFA.PRECIO + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '"$"#,##0.##' } } },
      fields: 'userEnteredFormat.numberFormat',
    } },
    { updateBorders: {
      range: { sheetId, startRowIndex: 0, endRowIndex: STYLE_LAST_ROW, ...VISIBLE_COLS_CENEFA },
      top: style, bottom: style, left: style, right: style, innerHorizontal: style, innerVertical: style,
    } },
    { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, endRowIndex: STYLE_LAST_ROW, ...VISIBLE_COLS_CENEFA } } } },
    ...widths.map(([index, pixelSize]) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS' as const, startIndex: index, endIndex: index + 1 },
        properties: { pixelSize },
        fields: 'pixelSize',
      },
    })),
  ]
}
