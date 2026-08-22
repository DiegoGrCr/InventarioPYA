'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Brand, Size } from '@/lib/types'

interface CenefaFiltersProps {
  brands: Brand[]
  sizes: Size[]
  currentFilters: { brand_id?: string; size_id?: string; search?: string; sort?: string }
}

export default function CenefaFilters({ brands, sizes, currentFilters }: CenefaFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.replace(`/cenefas?${params.toString()}`)
  }

  const clearFilters = () => router.replace('/cenefas')

  const hasFilters = currentFilters.brand_id || currentFilters.size_id || currentFilters.sort || currentFilters.search

  return (
    <div className="filters-bar">
      <select
        className="form-select"
        value={currentFilters.brand_id || ''}
        onChange={e => setFilter('brand_id', e.target.value)}
        style={{ maxWidth: '180px' }}
      >
        <option value="">Marca</option>
        {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      <select
        className="form-select"
        value={currentFilters.size_id || ''}
        onChange={e => setFilter('size_id', e.target.value)}
        style={{ maxWidth: '150px' }}
      >
        <option value="">Medida</option>
        {sizes.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>

      <select
        className="form-select"
        value={currentFilters.sort || ''}
        onChange={e => setFilter('sort', e.target.value)}
        style={{ maxWidth: '190px' }}
      >
        <option value="">Más recientes</option>
        <option value="price_asc">Precio: menor a mayor</option>
        <option value="price_desc">Precio: mayor a menor</option>
      </select>

      {hasFilters && (
        <button className="btn btn-ghost btn-sm" onClick={clearFilters}>✕ Limpiar</button>
      )}
    </div>
  )
}
