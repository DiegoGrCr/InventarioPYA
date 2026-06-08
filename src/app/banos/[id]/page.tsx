import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatPrice, getStockStatus, getStockLabel } from '@/lib/utils'
import { Pencil, Toilet } from 'lucide-react'
import BanoStockControl from '@/components/banos/BanoStockControl'
import DeleteBanoBtn from '@/components/banos/DeleteBanoBtn'

export default async function BanoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const isAdmin = await isAdminSession()
  const supabase = await createServerSupabaseClient()

  const { data: bano } = await supabase
    .from('bano_products')
    .select('*')
    .eq('id', id)
    .single()

  if (!bano) notFound()

  const stockStatus = getStockStatus(bano.stock)
  const badgeClass = stockStatus === 'available' ? 'badge-success' : stockStatus === 'low' ? 'badge-warning' : 'badge-danger'

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/banos" className="btn btn-ghost btn-icon">←</Link>
          <div>
            <h1>{bano.name}</h1>
            {bano.model && <p>Mod. {bano.model}</p>}
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href={`/banos/${id}/editar`} className="btn btn-secondary">
              <Pencil size={15} /> Editar
            </Link>
            <DeleteBanoBtn banoId={id} />
          </div>
        )}
      </div>

      <div className="detail-grid">
        <div className="detail-image">
          {bano.image_url ? (
            <img src={bano.image_url} alt={bano.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: '20px' }} />
          ) : (
            <div className="card-image-placeholder" style={{ borderRadius: 'var(--radius)', height: '100%' }}>
              <Toilet size={72} strokeWidth={1} />
            </div>
          )}
        </div>

        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-body">
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Información</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                {bano.brand && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Marca</span>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{bano.brand}</span>
                  </div>
                )}
                {bano.model && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Modelo</span>
                    <span className="badge badge-primary">{bano.model}</span>
                  </div>
                )}
                {bano.color && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Color</span>
                    <span style={{ fontSize: '14px' }}>{bano.color}</span>
                  </div>
                )}
                {bano.bodegas && bano.bodegas.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Bodega</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end' }}>
                      {bano.bodegas.map((b: string) => <span key={b} className="badge badge-accent">{b}</span>)}
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
                  {bano.price ? formatPrice(bano.price) : 'Sin precio'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className={`badge ${badgeClass}`} style={{ marginRight: '8px' }}>{getStockLabel(bano.stock)}</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{bano.stock} piezas</span>
                </div>
                <BanoStockControl banoId={bano.id} initialStock={bano.stock} />
              </div>
            </div>
          </div>

          {bano.description && (
            <div className="card">
              <div className="card-body">
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Descripción</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{bano.description}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
