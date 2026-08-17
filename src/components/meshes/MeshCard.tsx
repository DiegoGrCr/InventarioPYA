'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Mesh } from '@/lib/types'
import { formatPrice, getStockStatus, getStockLabel } from '@/lib/utils'
import { Grid3x3 } from 'lucide-react'

export default function MeshCard({ mesh, priority = false }: { mesh: Mesh; priority?: boolean }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const stockStatus = getStockStatus(mesh.stock)
  const badgeClass = stockStatus === 'available' ? 'badge-success' : stockStatus === 'low' ? 'badge-warning' : 'badge-danger'

  return (
    <Link href={`/mallas/${mesh.id}`} className="card fade-in" style={{ textDecoration: 'none' }}>
      <div className="card-image-wrapper">
        {mesh.image_url ? (
          <>
            {!imgLoaded && <div className="skeleton" style={{ position: 'absolute', inset: 0 }} />}
            <Image
              ref={(el) => {
                if (el?.complete) setImgLoaded(true)
              }}
              src={mesh.image_url}
              alt={mesh.name}
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
          <div className="card-image-placeholder"><Grid3x3 size={48} strokeWidth={1} /></div>
        )}
        {mesh.size && (
          <span className="card-image-size-badge">{mesh.size.label}</span>
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title">{mesh.name}</h3>
        <div className="card-meta">
          <span className={`badge ${badgeClass}`}>{getStockLabel(mesh.stock)}</span>
        </div>
        {mesh.brand && (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {mesh.brand.name}
          </p>
        )}
      </div>
      <div className="card-footer">
        <span style={{ fontWeight: 700, fontSize: '15px' }}>
          {mesh.price_per_sqm
            ? <>{formatPrice(mesh.price_per_sqm)}<span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}> /m²</span></>
            : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Sin precio</span>
          }
        </span>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Stock: {mesh.stock} {mesh.sale_unit === 'pieza' ? 'piezas' : 'cajas'}
        </span>
      </div>
    </Link>
  )
}
