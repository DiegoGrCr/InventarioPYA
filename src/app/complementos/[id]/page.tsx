import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice, getStockStatus, getStockLabel, getCategoryLabel } from '@/lib/utils'
import { Pencil, Droplets, PaintBucket } from 'lucide-react'
import AccessoryBodegaStockControl from '@/components/accessories/AccessoryBodegaStockControl'
import DeleteAccessoryBtn from '@/components/accessories/DeleteAccessoryBtn'
import BackButton from '@/components/BackButton'
import ShareButton from '@/components/ShareButton'

export default async function AccesorioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const isAdmin = await isAdminSession()
  const supabase = await createServerSupabaseClient()

  const [{ data: acc }, { data: bodegaStock }] = await Promise.all([
    supabase.from('accessories').select('*').eq('id', id).single(),
    supabase.from('accessory_bodega_stock').select('bodega, stock').eq('accessory_id', id).order('bodega'),
  ])

  if (!acc) notFound()

  const stockStatus = getStockStatus(acc.stock)
  const badgeClass = stockStatus === 'available' ? 'badge-success' : stockStatus === 'low' ? 'badge-warning' : 'badge-danger'
  const PlaceholderIcon = acc.category === 'adhesivo' ? Droplets : PaintBucket

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BackButton fallbackHref="/complementos" />
          <div>
            <h1>{acc.name}</h1>
            <p>{getCategoryLabel(acc.category)}{acc.sku ? ` · SKU: ${acc.sku}` : ''}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <ShareButton title={acc.name} />
          {isAdmin && (
            <>
              <Link href={`/complementos/${id}/editar`} className="btn btn-secondary">
                <Pencil size={15} /> Editar
              </Link>
              <DeleteAccessoryBtn accessoryId={id} />
            </>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-image">
          {acc.image_url ? (
            <Image src={acc.image_url} alt={acc.name} fill sizes="(max-width: 768px) 100vw, 500px" priority style={{ objectFit: 'contain', padding: '20px' }} />
          ) : (
            <div className="card-image-placeholder" style={{ borderRadius: 'var(--radius)', height: '100%' }}>
              <PlaceholderIcon size={72} strokeWidth={1} />
            </div>
          )}
        </div>

        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-body">
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Información</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Categoría</span>
                  <span className="badge badge-accent">{getCategoryLabel(acc.category)}</span>
                </div>
                {acc.brand && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Marca</span>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{acc.brand}</span>
                  </div>
                )}
                {acc.weight && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Peso</span>
                    <span className="badge badge-primary">{acc.weight}</span>
                  </div>
                )}
                {acc.color && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Color</span>
                    <span style={{ fontSize: '14px' }}>{acc.color}</span>
                  </div>
                )}
                {bodegaStock && bodegaStock.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Bodega</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end' }}>
                      {bodegaStock.map(b => <span key={b.bodega} className="badge badge-accent">{b.bodega}</span>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-body">
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Precio e Inventario</h3>
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '26px', fontWeight: 800 }}>
                  {acc.price ? formatPrice(acc.price) : 'Sin precio'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className={`badge ${badgeClass}`} style={{ marginRight: '8px' }}>{getStockLabel(acc.stock)}</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{acc.stock} bultos</span>
                </div>
                <AccessoryBodegaStockControl accessoryId={acc.id} initialStock={bodegaStock || []} />
              </div>
            </div>
          </div>

          {acc.description && (
            <div className="card">
              <div className="card-body">
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Descripción</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{acc.description}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
