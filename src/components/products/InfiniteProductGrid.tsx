'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getProductsPage } from '@/actions/products'
import ProductCard from '@/components/products/ProductCard'
import { Product } from '@/lib/types'
import { Loader2 } from 'lucide-react'

interface Props {
  initialProducts: Product[]
  filters: { material?: string; brand_id?: string; size_id?: string; search?: string }
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
        {products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
      <div ref={sentinelRef} style={{ height: '1px' }} />
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
        </div>
      )}
      {!hasMore && products.length > 0 && (
        <p style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
          — {products.length} productos —
        </p>
      )}
    </>
  )
}
