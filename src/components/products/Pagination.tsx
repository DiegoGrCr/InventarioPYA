'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
}

function getPageNumbers(page: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)

  const pages: (number | '...')[] = [1]
  if (page > 3) pages.push('...')

  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)
  for (let p = start; p <= end; p++) pages.push(p)

  if (page < totalPages - 2) pages.push('...')
  pages.push(totalPages)

  return pages
}

export default function Pagination({ page, totalPages }: PaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  if (totalPages <= 1) return null

  const goTo = (p: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (p <= 1) params.delete('page')
    else params.set('page', String(p))
    router.push(`/pisos?${params.toString()}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <nav className="pagination" aria-label="Paginación">
      <button className="pagination-btn" onClick={() => goTo(page - 1)} disabled={page <= 1} aria-label="Página anterior">
        <ChevronLeft size={16} />
      </button>

      {getPageNumbers(page, totalPages).map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="pagination-dots">…</span>
        ) : (
          <button
            key={p}
            className={`pagination-btn ${p === page ? 'active' : ''}`}
            onClick={() => goTo(p)}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        )
      )}

      <button className="pagination-btn" onClick={() => goTo(page + 1)} disabled={page >= totalPages} aria-label="Página siguiente">
        <ChevronRight size={16} />
      </button>
    </nav>
  )
}
