import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import InventoryTable from '@/components/inventory/InventoryTable'

export default async function InventarioPage() {
  if (!(await isAdminSession())) redirect('/pisos')

  const supabase = await createServerSupabaseClient()

  const [{ data: products }, { data: banos }, { data: accessories }, { data: brands }, { data: sizes }, { data: bodegaStockRows }, { data: accessoryBodegaStockRows }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, stock, sku, material, brand_id, size_id, sale_unit, price_per_sqm, price_per_box, sqm_per_box, pieces_per_box, brand:brands(name), size:sizes(label, width, height)')
      .eq('is_active', true)
      .order('stock', { ascending: true }),
    supabase
      .from('bano_products')
      .select('id, name, stock, brand, model, color, bodegas, price')
      .eq('is_active', true)
      .order('stock', { ascending: true }),
    supabase
      .from('accessories')
      .select('id, name, stock, category, bodegas')
      .eq('is_active', true)
      .order('stock', { ascending: true }),
    supabase.from('brands').select('id, name').order('name'),
    supabase.from('sizes').select('id, label, width, height'),
    supabase.from('product_bodega_stock').select('product_id, bodega, stock'),
    supabase.from('accessory_bodega_stock').select('accessory_id, bodega, stock'),
  ])

  const sortedSizes = (sizes || []).sort((a, b) => (a.width * a.height) - (b.width * b.height))

  const bodegaStockByProduct: Record<string, { bodega: string; stock: number }[]> = {}
  ;(bodegaStockRows || []).forEach(r => {
    if (!bodegaStockByProduct[r.product_id]) bodegaStockByProduct[r.product_id] = []
    bodegaStockByProduct[r.product_id].push({ bodega: r.bodega, stock: r.stock })
  })

  const bodegaStockByAccessory: Record<string, { bodega: string; stock: number }[]> = {}
  ;(accessoryBodegaStockRows || []).forEach(r => {
    if (!bodegaStockByAccessory[r.accessory_id]) bodegaStockByAccessory[r.accessory_id] = []
    bodegaStockByAccessory[r.accessory_id].push({ bodega: r.bodega, stock: r.stock })
  })

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>Inventario Rápido</h1>
          <p>Actualiza el stock de tus productos rápidamente</p>
        </div>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <InventoryTable
        products={(products || []) as any}
        banos={(banos || []) as any}
        accessories={(accessories || []) as any}
        brands={(brands || []) as any}
        sizes={sortedSizes as any}
        bodegaStockByProduct={bodegaStockByProduct}
        bodegaStockByAccessory={bodegaStockByAccessory}
      />
    </div>
  )
}
