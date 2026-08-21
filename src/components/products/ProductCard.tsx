'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Product } from '@/lib/types'
import { formatPrice, getStockStatus, getStockLabel, getMaterialLabel } from '@/lib/utils'
import { Layers } from 'lucide-react'

export default function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const stockStatus = getStockStatus(product.stock)
  const badgeClass = stockStatus === 'available' ? 'badge-success' : stockStatus === 'low' ? 'badge-warning' : 'badge-danger'

  return (
    <Link href={`/pisos/${product.id}`} className="card fade-in" style={{ textDecoration: 'none' }}>
      <div className="card-image-wrapper">
        {product.image_url ? (
          <>
            {!imgLoaded && <div className="skeleton" style={{ position: 'absolute', inset: 0 }} />}
            <Image
              ref={(el) => {
                // Si la imagen ya venía cargada del caché del navegador al montar
                // (ej. tras un refresh), el evento "load" pudo dispararse antes de
                // que React alcanzara a escucharlo — lo detectamos aquí también.
                if (el?.complete) setImgLoaded(true)
              }}
              src={product.image_url}
              alt={product.name}
              fill
              sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, 280px"
              priority={priority}
              loading={priority ? undefined : 'lazy'}
              className="card-image"
              style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 300ms ease' }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(true)}
            />
          </>
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
          {product.sale_unit === 'pieza'
            ? (product.price_per_box
                ? <>{formatPrice(product.price_per_box)}<span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}> /pieza</span></>
                : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Sin precio</span>)
            : (product.price_per_sqm
                ? <>{formatPrice(product.price_per_sqm)}<span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}> /m²</span></>
                : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Sin precio</span>)
          }
        </span>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Stock: {product.stock} {product.sale_unit === 'pieza' ? 'piezas' : 'cajas'}
        </span>
      </div>
    </Link>
  )
}
