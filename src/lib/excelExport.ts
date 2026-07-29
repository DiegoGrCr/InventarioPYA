import ExcelJS from 'exceljs'

const COLORS = {
  titleBg: 'FF1E3A5F',
  titleText: 'FFFFFFFF',
  headerBg: 'FFD9E2F3',
  headerText: 'FF1E293B',
  groupBg: 'FFEFF2F6',
  zeroBg: 'FFF8D7DA',
  border: 'FFB0B8C1',
}

const THIN = { style: 'thin' as const, color: { argb: COLORS.border } }
const ALL_BORDERS = { top: THIN, left: THIN, bottom: THIN, right: THIN }

interface PisoItem {
  name: string
  formato: string
  area: number
  piezas: number | null
  m2: number | null
  stock: number
  precio: number | null
  brand: string
}

interface BanoRow {
  name: string
  brand: string | null
  model: string | null
  color: string | null
  bodega: string
  stock: number
  price: number | null
}

interface AccessoryRow {
  name: string
  category: string
  bodega: string
  stock: number
}

function sanitizeSheetName(name: string, used: Set<string>) {
  const base = name.replace(/[\\/?*[\]:]/g, '').trim().slice(0, 28) || 'Hoja'
  let candidate = base
  let n = 2
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base} (${n++})`
  }
  used.add(candidate.toLowerCase())
  return candidate
}

function autoFitColumns(sheet: ExcelJS.Worksheet, colCount: number) {
  for (let c = 1; c <= colCount; c++) {
    let max = 10
    sheet.getColumn(c).eachCell({ includeEmpty: false }, cell => {
      const len = cell.value ? String(cell.value).length : 0
      if (len > max) max = len
    })
    sheet.getColumn(c).width = Math.min(max + 3, 45)
  }
}

function timestamp() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function buildBrandSheet(workbook: ExcelJS.Workbook, brandLabel: string, items: PisoItem[], usedNames: Set<string>, updatedAt: string) {
  const COLS = 6
  const sheet = workbook.addWorksheet(sanitizeSheetName(brandLabel.toUpperCase(), usedNames))

  sheet.mergeCells(1, 1, 1, 4)
  const title = sheet.getCell(1, 1)
  title.value = brandLabel.toUpperCase()
  title.font = { bold: true, size: 14, color: { argb: COLORS.titleText } }
  title.alignment = { horizontal: 'center', vertical: 'middle' }
  for (let c = 1; c <= 4; c++) {
    sheet.getCell(1, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } }
  }
  sheet.getRow(1).height = 28

  sheet.mergeCells(1, 5, 1, 6)
  const updated = sheet.getCell(1, 5)
  updated.value = `ACTUALIZADO:\n${updatedAt}`
  updated.font = { size: 9, color: { argb: 'FF6B7280' } }
  updated.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true }

  const headers = ['FORMATO', 'DESCRIPCIÓN', 'PIEZAS X CAJA', 'M² X CAJA', 'CAJAS EN EXISTENCIA', 'PRECIO']
  const headerRow = sheet.getRow(2)
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = { bold: true, color: { argb: COLORS.headerText } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = ALL_BORDERS
  })
  headerRow.height = 20

  sheet.views = [{ state: 'frozen', ySplit: 2 }]
  sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: COLS } }

  let rowIdx = 3
  let i = 0
  while (i < items.length) {
    const formato = items[i].formato
    let j = i
    while (j < items.length && items[j].formato === formato) j++
    const groupStartRow = rowIdx

    for (let k = i; k < j; k++) {
      const it = items[k]
      const row = sheet.getRow(rowIdx)
      row.getCell(1).value = formato
      row.getCell(2).value = it.name
      row.getCell(3).value = it.piezas ?? ''
      row.getCell(4).value = it.m2 ?? ''
      row.getCell(5).value = it.stock
      row.getCell(6).value = it.precio ?? ''

      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.groupBg } }
      row.getCell(2).alignment = { horizontal: 'left' }
      row.getCell(3).alignment = { horizontal: 'center' }
      row.getCell(4).alignment = { horizontal: 'center' }
      row.getCell(5).alignment = { horizontal: 'center' }
      row.getCell(4).numFmt = '0.00'
      row.getCell(6).numFmt = '"$"#,##0.00'

      const isZero = it.stock === 0
      for (let c = 1; c <= COLS; c++) {
        const cell = row.getCell(c)
        cell.border = ALL_BORDERS
        if (isZero && c !== 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zeroBg } }
      }
      rowIdx++
    }

    if (rowIdx - 1 > groupStartRow) sheet.mergeCells(groupStartRow, 1, rowIdx - 1, 1)
    i = j
  }

  if (items.length === 0) {
    sheet.getRow(3).getCell(2).value = 'Sin resultados'
  }

  autoFitColumns(sheet, COLS)
  return sheet
}

function addSimpleSheet(workbook: ExcelJS.Workbook, name: string, headers: string[], rows: (string | number)[][], usedNames: Set<string>) {
  const sheet = workbook.addWorksheet(sanitizeSheetName(name, usedNames))
  const headerRow = sheet.addRow(headers)
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: COLORS.headerText } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } }
    cell.border = ALL_BORDERS
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  headerRow.height = 20

  if (rows.length === 0) {
    sheet.addRow(['Sin resultados'])
  } else {
    rows.forEach(r => {
      const row = sheet.addRow(r)
      row.eachCell(cell => { cell.border = ALL_BORDERS })
    })
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }
  autoFitColumns(sheet, headers.length)
}

export async function buildInventoryWorkbook({
  items,
  banos,
  accessories,
}: {
  items: PisoItem[]
  banos: BanoRow[]
  accessories: AccessoryRow[]
}) {
  const workbook = new ExcelJS.Workbook()
  const usedNames = new Set<string>()
  const updatedAt = timestamp()

  const byBrand = new Map<string, PisoItem[]>()
  items.forEach(it => {
    if (!byBrand.has(it.brand)) byBrand.set(it.brand, [])
    byBrand.get(it.brand)!.push(it)
  })

  const brandNames = Array.from(byBrand.keys()).sort((a, b) => a.localeCompare(b))
  if (brandNames.length === 0) {
    buildBrandSheet(workbook, 'Sin resultados', [], usedNames, updatedAt)
  } else {
    brandNames.forEach(brandName => {
      const list = byBrand.get(brandName)!.sort((a, b) => a.area - b.area || a.name.localeCompare(b.name))
      buildBrandSheet(workbook, brandName, list, usedNames, updatedAt)
    })
  }

  addSimpleSheet(
    workbook,
    'Baños',
    ['Producto', 'Marca', 'Modelo', 'Color', 'Bodega', 'Stock', 'Precio'],
    banos.map(b => [b.name, b.brand || '', b.model || '', b.color || '', b.bodega, b.stock, b.price ?? '']),
    usedNames
  )

  addSimpleSheet(
    workbook,
    'Adhesivos',
    ['Producto', 'Categoría', 'Bodega', 'Stock'],
    accessories.map(a => [a.name, a.category === 'adhesivo' ? 'Adhesivo' : 'Boquilla', a.bodega, a.stock]),
    usedNames
  )

  return workbook
}

export async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
