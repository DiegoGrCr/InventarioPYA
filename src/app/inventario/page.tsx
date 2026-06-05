import { createServerSupabaseClient } from '@/lib/supabase/server'
import InventoryTable from '@/components/inventory/InventoryTable'

export default async function InventarioPage() {
  const supabase = await createServerSupabaseClient()

  const [{ data: products }, { data: accessories }, { data: brands }, { data: sizes }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, stock, sku, material, brand_id, size_id, price_per_sqm, price_per_box, sqm_per_box, brand:brands(name), size:sizes(label)')
      .eq('is_active', true)
      .order('stock', { ascending: true }),
    supabase
      .from('accessories')
      .select('id, name, stock, category')
      .eq('is_active', true)
      .order('stock', { ascending: true }),
    supabase.from('brands').select('id, name').order('name'),
    supabase.from('sizes').select('id, label, width, height'),
  ])

  const sortedSizes = (sizes || []).sort((a, b) => (a.width * a.height) - (b.width * b.height))

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
        accessories={(accessories || []) as any}
        brands={(brands || []) as any}
        sizes={sortedSizes as any}
      />
    </div>
  )
}
