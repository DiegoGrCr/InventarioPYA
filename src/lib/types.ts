export const WAREHOUSES = ['La Playita', 'Arroyo de Cañas', 'Lagunita', 'Plomería', 'Matriz'] as const

export interface Brand {
  id: string
  name: string
  is_imported: boolean
  created_at: string
}

export interface Size {
  id: string
  width: number
  height: number
  label: string
  created_at: string
}

export interface Product {
  id: string
  name: string
  description: string | null
  material: 'ceramica' | 'porcelana'
  brand_id: string | null
  size_id: string | null
  sku: string | null
  image_url: string | null
  finish: string | null
  color: string | null
  bodegas: string[] | null
  stock: number
  sale_unit: 'caja' | 'pieza'
  pieces_per_box: number | null
  sqm_per_box: number | null
  price_per_sqm: number | null
  price_per_box: number | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined fields
  brand?: Brand
  size?: Size
}

export interface Accessory {
  id: string
  name: string
  description: string | null
  category: 'adhesivo' | 'boquilla'
  brand: string | null
  weight: string | null
  color: string | null
  bodegas: string[] | null
  image_url: string | null
  stock: number
  price: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BanoProduct {
  id: string
  name: string
  brand: string | null
  model: string | null
  color: string | null
  bodegas: string[] | null
  description: string | null
  image_url: string | null
  stock: number
  price: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type MaterialType = 'ceramica' | 'porcelana'
export type AccessoryCategory = 'adhesivo' | 'boquilla'

export interface DashboardStats {
  totalProducts: number
  totalAccessories: number
  lowStockProducts: number
  totalBrands: number
}
