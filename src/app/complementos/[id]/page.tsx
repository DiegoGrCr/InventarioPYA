import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatPrice, getStockStatus, getStockLabel, getCategoryLabel } from '@/lib/utils'
import { Pencil, Droplets, PaintBucket } from 'lucide-react'
import AccessoryStockControl from '@/components/accessories/AccessoryStockControl'
import DeleteAccessoryBtn from '@/components/accessories/DeleteAccessoryBtn'

export default async function AccesorioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: acc } = await supabase
    .from('accessories')
    .select('*')
    .eq('id', id)
    .single()

  if (!acc) notFound()

  const stockStatus = getStockStatus(acc.stock)
  const badgeClass = stockStatus === 'available' ? 'badge-success' : stockStatus === 'low' ? 'badge-warning' : 'badge-danger'
  const PlaceholderIcon = acc.category === 'adhesivo' ? Droplets : PaintBucket

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/complementos" className="btn btn-ghost btn-icon">←</Link>
          <div>
            <h1>{acc.name}</h1>
            <p>{getCategoryLabel(acc.category)}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link href={`/complementos/${id}/editar`} className="btn btn-secondary">
            <Pencil size={15} /> Editar
          </Link>
          <DeleteAccessoryBtn accessoryId={id} />
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-image">
          {acc.image_url ? (
            <img src={acc.image_url} alt={acc.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: '20px' }} />
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
                {acc.bodegas && acc.bodegas.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Bodega</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end' }}>
                      {acc.bodegas.map((b: string) => <span key={b} className="badge badge-accent">{b}</span>)}
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
                <AccessoryStockControl accessoryId={acc.id} initialStock={acc.stock} />
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
