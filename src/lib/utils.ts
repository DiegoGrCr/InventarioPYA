export function formatPrice(price: number | null): string {
  if (price === null) return 'Sin precio'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(price)
}

export function formatPricePerSqm(pricePerBox: number | null, sqmPerBox: number | null): string {
  if (!pricePerBox || !sqmPerBox || sqmPerBox === 0) return 'Sin precio'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(pricePerBox / sqmPerBox)
}

export function getStockStatus(stock: number): 'available' | 'low' | 'out' {
  if (stock <= 0) return 'out'
  if (stock <= 5) return 'low'
  return 'available'
}

export function getStockLabel(stock: number): string {
  if (stock <= 0) return 'Agotado'
  if (stock <= 5) return 'Poco stock'
  return 'Disponible'
}

export function getMaterialLabel(material: string): string {
  return material === 'ceramica' ? 'Cerámica' : 'Porcelana'
}

export function getCategoryLabel(category: string): string {
  return category === 'adhesivo' ? 'Adhesivo' : 'Boquilla'
}

export function generateSKU(brand: string, size: string, material: string): string {
  const b = brand.substring(0, 3).toUpperCase()
  const s = size.replace('x', '')
  const m = material === 'ceramica' ? 'CER' : 'POR'
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `${b}-${s}-${m}-${random}`
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
