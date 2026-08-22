import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import Link from 'next/link'
import { Suspense } from 'react'
import CenefaFilters from '@/components/cenefas/CenefaFilters'
import CenefaCard from '@/components/cenefas/CenefaCard'
import ScrollReveal from '@/components/ScrollReveal'
import Pagination from '@/components/products/Pagination'

const PAGE_SIZE = 20

export default async function CenefasPage({ searchParams }: { searchParams: Promise<{ brand_id?: string; size_id?: string; search?: string; sort?: string; page?: string }> }) {
  const params = await searchParams
  const isAdmin = await isAdminSession()
  const supabase = await createServerSupabaseClient()

  const page = Math.max(1, parseInt(params.page || '1') || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('cenefas')
    .select('*, brand:brands(*), size:sizes(*)')
    .eq('is_active', true)
    .range(from, to)

  if (params.sort === 'price_asc')
    query = query.order('price_per_sqm', { ascending: true, nullsFirst: false })
  else if (params.sort === 'price_desc')
    query = query.order('price_per_sqm', { ascending: false, nullsFirst: false })
  else
    query = query.order('created_at', { ascending: false })

  if (params.brand_id) query = query.eq('brand_id', params.brand_id)
  if (params.size_id) query = query.eq('size_id', params.size_id)
  if (params.search) query = query.ilike('name', `%${params.search}%`)

  let countQuery = supabase
    .from('cenefas')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  if (params.brand_id) countQuery = countQuery.eq('brand_id', params.brand_id)
  if (params.size_id) countQuery = countQuery.eq('size_id', params.size_id)
  if (params.search) countQuery = countQuery.ilike('name', `%${params.search}%`)

  const [{ data: cenefas }, { count }, { data: brands }, { data: sizes }] = await Promise.all([
    query,
    countQuery,
    supabase.from('brands').select('*').order('name'),
    supabase.from('sizes').select('*').order('width'),
  ])

  const items = cenefas || []
  const total = count || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>Catálogo de Cenefas</h1>
          <p>{total} productos encontrados</p>
        </div>
        {isAdmin && <Link href="/cenefas/nuevo" className="btn btn-primary">+ Nueva Cenefa</Link>}
      </div>

      <Suspense fallback={<div className="filters-bar" style={{ height: '42px' }} />}>
        <CenefaFilters
          brands={brands || []}
          sizes={sizes || []}
          currentFilters={params}
        />
      </Suspense>

      {items.length > 0 ? (
        <>
          <div className="product-grid">
            {items.map((c, i) => (
              <ScrollReveal key={c.id} delay={(i % 4) * 70}>
                <CenefaCard cenefa={c} priority={i < 8} />
              </ScrollReveal>
            ))}
          </div>
          <Suspense fallback={null}>
            <Pagination page={page} totalPages={totalPages} basePath="/cenefas" />
          </Suspense>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>No se encontraron cenefas</h3>
          <p>Intenta cambiar los filtros{isAdmin ? ' o agrega una nueva cenefa' : ''}</p>
          {isAdmin && <Link href="/cenefas/nuevo" className="btn btn-primary">+ Agregar Cenefa</Link>}
        </div>
      )}
    </div>
  )
}
