import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import Link from 'next/link'
import { Suspense } from 'react'
import ProductCard from '@/components/products/ProductCard'
import ProductFilters from '@/components/products/ProductFilters'

export default async function PisosPage({ searchParams }: { searchParams: Promise<{ material?: string; brand_id?: string; size_id?: string; search?: string }> }) {
  const params = await searchParams
  const isAdmin = await isAdminSession()
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('products')
    .select('*, brand:brands(*), size:sizes(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (params.material) query = query.eq('material', params.material)
  if (params.brand_id) query = query.eq('brand_id', params.brand_id)
  if (params.size_id) query = query.eq('size_id', params.size_id)
  if (params.search) query = query.ilike('name', `%${params.search}%`)

  const { data: products } = await query
  const { data: brands } = await supabase.from('brands').select('*').order('name')
  const { data: sizes } = await supabase.from('sizes').select('*').order('width')

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>Catálogo de Pisos</h1>
          <p>{products?.length || 0} productos encontrados</p>
        </div>
        {isAdmin && <Link href="/pisos/nuevo" className="btn btn-primary">+ Nuevo Piso</Link>}
      </div>

      <Suspense fallback={<div className="filters-bar" style={{ height: '42px' }} />}>
        <ProductFilters
          brands={brands || []}
          sizes={sizes || []}
          currentFilters={params}
        />
      </Suspense>

      {products && products.length > 0 ? (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>No se encontraron pisos</h3>
          <p>Intenta cambiar los filtros{isAdmin ? ' o agrega un nuevo producto' : ''}</p>
          {isAdmin && <Link href="/pisos/nuevo" className="btn btn-primary">+ Agregar Piso</Link>}
        </div>
      )}
    </div>
  )
}
