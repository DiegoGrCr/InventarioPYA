'use client'

import Link from 'next/link'
import { Product } from '@/lib/types'
import { formatPrice, getStockStatus, getStockLabel, getMaterialLabel } from '@/lib/utils'
import { Layers } from 'lucide-react'

export default function ProductCard({ product }: { product: Product }) {
  const stockStatus = getStockStatus(product.stock)
  const badgeClass = stockStatus === 'available' ? 'badge-success' : stockStatus === 'low' ? 'badge-warning' : 'badge-danger'

  return (
    <Link href={`/pisos/${product.id}`} className="card fade-in" style={{ textDecoration: 'none' }}>
      <div className="card-image-wrapper">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="card-image" />
        ) : (
          <div className="card-image-placeholder"><Layers size={48} strokeWidth={1} /></div>
        )}
        {product.size && (
          <span className="card-image-size-badge">{product.size.label}</span>
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title">{product.name}</h3>
        <div className="card-meta">
          <span className="badge badge-primary">{getMaterialLabel(product.material)}</span>
          <span className={`badge ${badgeClass}`}>{getStockLabel(product.stock)}</span>
        </div>
        {product.brand && (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {product.brand.name}
          </p>
        )}
      </div>
      <div className="card-footer">
        <span style={{ fontWeight: 700, fontSize: '15px' }}>
          {product.price_per_sqm
            ? <>{formatPrice(product.price_per_sqm)}<span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}> /m²</span></>
            : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Sin precio</span>
          }
        </span>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Stock: {product.stock} cajas
        </span>
      </div>
    </Link>
  )
}
