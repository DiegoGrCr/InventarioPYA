import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import { likeSafe } from '@/lib/utils'
import Link from 'next/link'
import { Suspense } from 'react'
import ProductFilters from '@/components/products/ProductFilters'
import ProductCard from '@/components/products/ProductCard'
import ScrollReveal from '@/components/ScrollReveal'
import Pagination from '@/components/products/Pagination'

const PAGE_SIZE = 20

export default async function PisosPage({ searchParams }: { searchParams: Promise<{ material?: string; brand_id?: string; size_id?: string; search?: string; color?: string; finish?: string; format?: string; sort?: string; page?: string }> }) {
  const params = await searchParams
  const isAdmin = await isAdminSession()
  const supabase = await createServerSupabaseClient()

  const page = Math.max(1, parseInt(params.page || '1') || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // "format" (cuadrado/rectangular) no es una columna directa — se resuelve
  // comparando ancho y alto de cada medida (igual que en el asistente de IA,
  // que genera enlaces a este catálogo con este mismo filtro).
  let formatSizeIds: string[] | null = null
  if (params.format === 'cuadrado' || params.format === 'rectangular') {
    const { data: allSizes } = await supabase.from('sizes').select('id, width, height')
    formatSizeIds = (allSizes || [])
      .filter(s => params.format === 'cuadrado' ? s.width === s.height : s.width !== s.height)
      .map(s => s.id)
  }

  let query = supabase
    .from('products')
    .select('*, brand:brands(*), size:sizes(*)')
    .eq('is_active', true)
    .range(from, to)

  if (params.sort === 'price_asc')
    query = query.order('price_per_sqm', { ascending: true, nullsFirst: false })
  else if (params.sort === 'price_desc')
    query = query.order('price_per_sqm', { ascending: false, nullsFirst: false })
  else
    query = query.order('created_at', { ascending: false })

  if (params.material) query = query.eq('material', params.material)
  if (params.brand_id) query = query.eq('brand_id', params.brand_id)
  if (params.size_id) query = query.eq('size_id', params.size_id)
  if (params.search) query = query.ilike('name', `%${params.search}%`)
  if (params.color) query = query.or(`color.ilike.${likeSafe(params.color)},description.ilike.${likeSafe(params.color)}`)
  if (params.finish) query = query.ilike('finish', `%${params.finish}%`)
  if (formatSizeIds) query = formatSizeIds.length > 0 ? query.in('size_id', formatSizeIds) : query.eq('size_id', 'no-match')

  let countQuery = supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  if (params.material) countQuery = countQuery.eq('material', params.material)
  if (params.brand_id) countQuery = countQuery.eq('brand_id', params.brand_id)
  if (params.size_id) countQuery = countQuery.eq('size_id', params.size_id)
  if (params.search) countQuery = countQuery.ilike('name', `%${params.search}%`)
  if (params.color) countQuery = countQuery.or(`color.ilike.${likeSafe(params.color)},description.ilike.${likeSafe(params.color)}`)
  if (params.finish) countQuery = countQuery.ilike('finish', `%${params.finish}%`)
  if (formatSizeIds) countQuery = formatSizeIds.length > 0 ? countQuery.in('size_id', formatSizeIds) : countQuery.eq('size_id', 'no-match')

  const [{ data: products }, { count }, { data: brands }, { data: sizes }] = await Promise.all([
    query,
    countQuery,
    supabase.from('brands').select('*').order('name'),
    supabase.from('sizes').select('*').order('width'),
  ])

  const items = products || []
  const total = count || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

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

      {items.length > 0 ? (
        <>
          <div className="product-grid">
            {items.map((p, i) => (
              <ScrollReveal key={p.id} delay={(i % 4) * 70}>
                <ProductCard product={p} priority={i < 8} />
              </ScrollReveal>
            ))}
          </div>
          <Suspense fallback={null}>
            <Pagination page={page} totalPages={totalPages} />
          </Suspense>
        </>
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
