// Lógica pura de agrupar/ordenar productos de pisos por marca → formato → nombre.
// La usa tanto el export a Excel (src/lib/excelExport.ts) como el sync a Google
// Sheets (src/lib/sheetSync.ts), para que ambos generen exactamente el mismo
// orden y agrupamiento.

export function groupByBrand<T extends { brand: string }>(items: T[]): Map<string, T[]> {
  const byBrand = new Map<string, T[]>()
  items.forEach(it => {
    if (!byBrand.has(it.brand)) byBrand.set(it.brand, [])
    byBrand.get(it.brand)!.push(it)
  })
  return byBrand
}

export function sortByFormatoThenName<T extends { area: number; name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.area - b.area || a.name.localeCompare(b.name))
}

export interface FormatoGroup<T> {
  formato: string
  items: T[]
}

// Agrupa corridas consecutivas de mismo "formato" — asume que items ya viene
// ordenado (ver sortByFormatoThenName) para que los iguales queden juntos.
// Sirve tanto para combinar celdas en Excel como para calcular cuántas filas
// ocupará cada formato en una hoja de Google Sheets.
export function groupConsecutiveByFormato<T extends { formato: string }>(items: T[]): FormatoGroup<T>[] {
  const groups: FormatoGroup<T>[] = []
  let i = 0
  while (i < items.length) {
    const formato = items[i].formato
    let j = i
    while (j < items.length && items[j].formato === formato) j++
    groups.push({ formato, items: items.slice(i, j) })
    i = j
  }
  return groups
}

// Nombre de hoja/pestaña sanitizado y único dentro de un archivo — Excel limita
// a 31 caracteres y Google Sheets a 100, ambos prohíben \ / ? * [ ] :
export function sanitizeTabName(name: string, used: Set<string>, maxLength: number): string {
  const base = name.replace(/[\\/?*[\]:]/g, '').trim().slice(0, maxLength) || 'Hoja'
  let candidate = base
  let n = 2
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base} (${n++})`
  }
  used.add(candidate.toLowerCase())
  return candidate
}
