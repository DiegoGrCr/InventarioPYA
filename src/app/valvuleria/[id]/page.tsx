import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice, getStockStatus, getStockLabel } from '@/lib/utils'
import { Pencil, Wrench } from 'lucide-react'
import ValvuleriaBodegaStockControl from '@/components/valvuleria/ValvuleriaBodegaStockControl'
import DeleteValvuleriaBtn from '@/components/valvuleria/DeleteValvuleriaBtn'
import BackButton from '@/components/BackButton'
import ShareButton from '@/components/ShareButton'

export default async function ValvuleriaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const isAdmin = await isAdminSession()
  const supabase = await createServerSupabaseClient()

  const [{ data: item }, { data: bodegaStock }] = await Promise.all([
    supabase.from('valvuleria').select('*').eq('id', id).single(),
    supabase.from('valvuleria_bodega_stock').select('bodega, stock').eq('valvuleria_id', id).order('bodega'),
  ])

  if (!item) notFound()

  const stockStatus = getStockStatus(item.stock)
  const badgeClass = stockStatus === 'available' ? 'badge-success' : stockStatus === 'low' ? 'badge-warning' : 'badge-danger'

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BackButton fallbackHref="/valvuleria" />
          <div>
            <h1>{item.name}</h1>
            <p>{item.sku ? `SKU: ${item.sku}` : 'Valvulería'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <ShareButton title={item.name} />
          {isAdmin && (
            <>
              <Link href={`/valvuleria/${id}/editar`} className="btn btn-secondary">
                <Pencil size={15} /> Editar
              </Link>
              <DeleteValvuleriaBtn valvuleriaId={id} />
            </>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-image">
          {item.image_url ? (
            <Image src={item.image_url} alt={item.name} fill sizes="(max-width: 768px) 100vw, 500px" priority style={{ objectFit: 'contain', padding: '20px' }} />
          ) : (
            <div className="card-image-placeholder" style={{ borderRadius: 'var(--radius)', height: '100%' }}>
              <Wrench size={72} strokeWidth={1} />
            </div>
          )}
        </div>

        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-body">
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Información</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                {item.brand && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Marca</span>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{item.brand}</span>
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
                  {item.price ? formatPrice(item.price) : 'Sin precio'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className={`badge ${badgeClass}`} style={{ marginRight: '8px' }}>{getStockLabel(item.stock)}</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{item.stock} unidades</span>
                </div>
                <ValvuleriaBodegaStockControl valvuleriaId={item.id} initialStock={bodegaStock || []} />
              </div>
            </div>
          </div>

          {item.description && (
            <div className="card" style={{ marginBottom: '16px' }}>
              <div className="card-body">
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Descripción</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.description}</p>
              </div>
            </div>
          )}

          {item.comments && (
            <div className="card">
              <div className="card-body">
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Comentarios</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.comments}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
