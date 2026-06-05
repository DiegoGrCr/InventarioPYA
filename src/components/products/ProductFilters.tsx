'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { Brand, Size } from '@/lib/types'
import { X } from 'lucide-react'

interface ProductFiltersProps {
  brands: Brand[]
  sizes: Size[]
  currentFilters: { material?: string; brand_id?: string; size_id?: string; search?: string }
}

export default function ProductFilters({ brands, sizes, currentFilters }: ProductFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [searchInput, setSearchInput] = useState(currentFilters.search || '')

  // Sync when the URL search param changes (e.g. from the header search)
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setSearchInput(currentFilters.search || '')
    }
  }, [currentFilters.search])

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.replace(`/pisos?${params.toString()}`)
  }

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set('search', value)
      else params.delete('search')
      router.replace(`/pisos?${params.toString()}`)
    }, 300)
  }

  const clearFilters = () => {
    setSearchInput('')
    router.replace('/pisos')
  }

  const hasFilters = currentFilters.material || currentFilters.brand_id || currentFilters.size_id || currentFilters.search

  return (
    <div className="filters-bar">
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          className="form-input"
          placeholder="🔍 Buscar pisos..."
          value={searchInput}
          onChange={e => handleSearchChange(e.target.value)}
          style={{ maxWidth: '240px', paddingRight: searchInput ? '32px' : undefined }}
        />
        {searchInput && (
          <button
            onClick={() => handleSearchChange('')}
            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      <select
        className="form-select"
        value={currentFilters.material || ''}
        onChange={e => setFilter('material', e.target.value)}
        style={{ maxWidth: '160px' }}
      >
        <option value="">Material</option>
        <option value="ceramica">Cerámica</option>
        <option value="porcelana">Porcelana</option>
      </select>

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

      {hasFilters && (
        <button className="btn btn-ghost btn-sm" onClick={clearFilters}>✕ Limpiar</button>
      )}
    </div>
  )
}
