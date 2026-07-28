'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getProductsPage } from '@/actions/products'
import ProductCard from '@/components/products/ProductCard'
import ScrollReveal from '@/components/ScrollReveal'
import { Product } from '@/lib/types'

interface Props {
  initialProducts: Product[]
  filters: { material?: string; brand_id?: string; size_id?: string; search?: string; sort?: string }
  initialHasMore: boolean
}

export default function InfiniteProductGrid({ initialProducts, filters, initialHasMore }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loading, setLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    try {
      const { products: next, hasMore: more } = await getProductsPage(filters, page)
      setProducts(prev => [...prev, ...next])
      setPage(prev => prev + 1)
      setHasMore(more)
    } catch {
      // silent — user can scroll again to retry
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, filters, page])

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '300px' }
    )
    if (sentinelRef.current) obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [loadMore])

  return (
    <>
      <div className="product-grid">
        {products.map((p, i) => (
          <ScrollReveal key={p.id} delay={(i % 4) * 70}>
            <ProductCard product={p} priority={i < 8} />
          </ScrollReveal>
        ))}
        {loading && Array.from({ length: 4 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="skeleton-card">
            <div className="skeleton skeleton-image" />
            <div className="card-body">
              <div className="skeleton skeleton-title" />
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div className="skeleton skeleton-badge" />
                <div className="skeleton skeleton-badge" />
              </div>
              <div className="skeleton skeleton-text-sm" />
            </div>
            <div className="card-footer">
              <div className="skeleton skeleton-text" style={{ width: 80 }} />
              <div className="skeleton skeleton-text-sm" style={{ width: 90 }} />
            </div>
          </div>
        ))}
      </div>
      <div ref={sentinelRef} style={{ height: '1px' }} />
      {!hasMore && products.length > 0 && (
        <p style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
          — {products.length} productos —
        </p>
      )}
    </>
  )
}
