import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import Link from 'next/link'
import { Suspense } from 'react'
import ProductFilters from '@/components/products/ProductFilters'
import InfiniteProductGrid from '@/components/products/InfiniteProductGrid'

const PAGE_SIZE = 12

export default async function PisosPage({ searchParams }: { searchParams: Promise<{ material?: string; brand_id?: string; size_id?: string; search?: string }> }) {
  const params = await searchParams
  const isAdmin = await isAdminSession()
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('products')
    .select('*, brand:brands(*), size:sizes(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(0, PAGE_SIZE - 1)

  if (params.material) query = query.eq('material', params.material)
  if (params.brand_id) query = query.eq('brand_id', params.brand_id)
  if (params.size_id) query = query.eq('size_id', params.size_id)
  if (params.search) query = query.ilike('name', `%${params.search}%`)

  let countQuery = supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  if (params.material) countQuery = countQuery.eq('material', params.material)
  if (params.brand_id) countQuery = countQuery.eq('brand_id', params.brand_id)
  if (params.size_id) countQuery = countQuery.eq('size_id', params.size_id)
  if (params.search) countQuery = countQuery.ilike('name', `%${params.search}%`)

  const [{ data: products }, { count }, { data: brands }, { data: sizes }] = await Promise.all([
    query,
    countQuery,
    supabase.from('brands').select('*').order('name'),
    supabase.from('sizes').select('*').order('width'),
  ])

  const initial = products || []
  const total = count || 0
  const hasMore = initial.length === PAGE_SIZE && total > PAGE_SIZE

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>Catálogo de Pisos</h1>
          <p>{total} productos encontrados</p>
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

      {initial.length > 0 ? (
        <InfiniteProductGrid
          key={JSON.stringify(params)}
          initialProducts={initial}
          filters={params}
          initialHasMore={hasMore}
        />
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
