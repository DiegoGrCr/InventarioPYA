'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { Search, X, Menu } from 'lucide-react'

export default function Header({ onMenuToggle }: { onMenuToggle: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [value, setValue] = useState(
    pathname === '/buscar' ? (searchParams.get('q') || '') : ''
  )

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setValue(pathname === '/buscar' ? (searchParams.get('q') || '') : '')
    }
  }, [pathname, searchParams])

  const handleChange = (text: string) => {
    setValue(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (text.trim()) {
        router.replace(`/buscar?q=${encodeURIComponent(text.trim())}`)
      } else {
        router.replace('/buscar')
      }
    }, 300)
  }

  const handleClear = () => {
    setValue('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    router.replace('/buscar')
  }

  const isHome = pathname === '/'

  return (
    <header className="header">
      <button className="menu-toggle" onClick={onMenuToggle} aria-label="Menu">
        <Menu size={22} />
      </button>
      {!isHome && (
        <div className="header-search">
          <span className="header-search-icon"><Search size={14} /></span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar pisos, baños, adhesivos..."
            value={value}
            onChange={e => handleChange(e.target.value)}
          />
          {value && (
            <button
              onClick={handleClear}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              aria-label="Limpiar búsqueda"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
    </header>
  )
}
