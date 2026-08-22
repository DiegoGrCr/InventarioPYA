'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Cenefa } from '@/lib/types'
import { formatPrice, getStockStatus, getStockLabel } from '@/lib/utils'
import { Rows3 } from 'lucide-react'

export default function CenefaCard({ cenefa, priority = false }: { cenefa: Cenefa; priority?: boolean }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const stockStatus = getStockStatus(cenefa.stock)
  const badgeClass = stockStatus === 'available' ? 'badge-success' : stockStatus === 'low' ? 'badge-warning' : 'badge-danger'

  return (
    <Link href={`/cenefas/${cenefa.id}`} className="card fade-in" style={{ textDecoration: 'none' }}>
      <div className="card-image-wrapper">
        {cenefa.image_url ? (
          <>
            {!imgLoaded && <div className="skeleton" style={{ position: 'absolute', inset: 0 }} />}
            <Image
              ref={(el) => {
                if (el?.complete) setImgLoaded(true)
              }}
              src={cenefa.image_url}
              alt={cenefa.name}
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
          <div className="card-image-placeholder"><Rows3 size={48} strokeWidth={1} /></div>
        )}
        {cenefa.size && (
          <span className="card-image-size-badge">{cenefa.size.label}</span>
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title">{cenefa.name}</h3>
        <div className="card-meta">
          <span className={`badge ${badgeClass}`}>{getStockLabel(cenefa.stock)}</span>
        </div>
        {cenefa.brand && (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {cenefa.brand.name}
          </p>
        )}
      </div>
      <div className="card-footer">
        <span style={{ fontWeight: 700, fontSize: '15px' }}>
          {cenefa.sale_unit === 'pieza'
            ? (cenefa.price_per_box
                ? <>{formatPrice(cenefa.price_per_box)}<span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}> /pieza</span></>
                : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Sin precio</span>)
            : (cenefa.price_per_sqm
                ? <>{formatPrice(cenefa.price_per_sqm)}<span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}> /m²</span></>
                : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Sin precio</span>)
          }
        </span>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Stock: {cenefa.stock} {cenefa.sale_unit === 'pieza' ? 'piezas' : 'cajas'}
        </span>
      </div>
    </Link>
  )
}
