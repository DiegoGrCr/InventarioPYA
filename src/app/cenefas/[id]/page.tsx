import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice, getStockStatus, getStockLabel } from '@/lib/utils'
import { Pencil, Rows3 } from 'lucide-react'
import CenefaBodegaStockControl from '@/components/cenefas/CenefaBodegaStockControl'
import DeleteCenefaBtn from '@/components/cenefas/DeleteCenefaBtn'
import ProductCalculator from '@/components/products/ProductCalculator'
import BackButton from '@/components/BackButton'
import ShareButton from '@/components/ShareButton'

export default async function CenefaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const isAdmin = await isAdminSession()
  const supabase = await createServerSupabaseClient()

  const [{ data: cenefa }, { data: bodegaStock }] = await Promise.all([
    supabase.from('cenefas').select('*, brand:brands(*), size:sizes(*)').eq('id', id).single(),
    supabase.from('cenefa_bodega_stock').select('bodega, stock').eq('cenefa_id', id).order('bodega'),
  ])

  if (!cenefa) notFound()

  const stockStatus = getStockStatus(cenefa.stock)
  const badgeClass = stockStatus === 'available' ? 'badge-success' : stockStatus === 'low' ? 'badge-warning' : 'badge-danger'

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BackButton fallbackHref="/cenefas" />
          <div>
            <h1>{cenefa.name}</h1>
            {cenefa.sku && <p>SKU: {cenefa.sku}</p>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <ShareButton title={cenefa.name} />
          {isAdmin && (
            <>
              <Link href={`/cenefas/${id}/editar`} className="btn btn-secondary"><Pencil size={15} /> Editar</Link>
              <DeleteCenefaBtn cenefaId={id} />
            </>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-image">
          {cenefa.image_url ? (
            <Image src={cenefa.image_url} alt={cenefa.name} fill sizes="(max-width: 768px) 100vw, 500px" priority style={{ objectFit: 'contain', padding: '20px' }} />
          ) : (
            <div className="card-image-placeholder" style={{ borderRadius: 'var(--radius)', height: '100%' }}><Rows3 size={72} strokeWidth={1} /></div>
          )}
          {cenefa.size && (
            <span style={{ position: 'absolute', bottom: '12px', right: '12px', background: 'rgba(10,10,15,0.75)', backdropFilter: 'blur(6px)', color: 'var(--accent)', fontSize: '13px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(34,211,238,0.3)' }}>
              {(cenefa.size as { label: string }).label}
            </span>
          )}
        </div>

        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-body">
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Información</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                {cenefa.brand && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Marca</span>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{(cenefa.brand as { name: string }).name}</span>
                  </div>
                )}
                {cenefa.size && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Medida</span>
                    <span className="badge badge-accent">{(cenefa.size as { label: string }).label}</span>
                  </div>
                )}
                {cenefa.finish && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Acabado</span>
                    <span style={{ fontSize: '14px' }}>{cenefa.finish}</span>
                  </div>
                )}
                {cenefa.color && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Color</span>
                    <span style={{ fontSize: '14px' }}>{cenefa.color}</span>
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
                {cenefa.pieces_per_box && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Piezas/caja</span>
                    <span style={{ fontSize: '14px' }}>{cenefa.pieces_per_box}</span>
                  </div>
                )}
                {cenefa.sqm_per_box && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{cenefa.sale_unit === 'pieza' ? 'm²/pieza' : 'm²/caja'}</span>
                    <span style={{ fontSize: '14px' }}>{cenefa.sqm_per_box}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-body">
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Precio e Inventario</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '26px', fontWeight: 800 }}>
                  {cenefa.price_per_sqm ? formatPrice(cenefa.price_per_sqm) : 'Sin precio'}
                </span>
                {cenefa.price_per_sqm && <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>por m²</span>}
              </div>
              {cenefa.price_per_box && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: cenefa.sale_unit === 'pieza' && cenefa.pieces_per_box ? '4px' : '16px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{formatPrice(cenefa.price_per_box)}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{cenefa.sale_unit === 'pieza' ? 'por pieza' : 'por caja'}</span>
                </div>
              )}
              {cenefa.sale_unit === 'pieza' && cenefa.price_per_box && cenefa.pieces_per_box && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{formatPrice(cenefa.price_per_box * cenefa.pieces_per_box)}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>por caja ({cenefa.pieces_per_box} piezas)</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className={`badge ${badgeClass}`} style={{ marginRight: '8px' }}>{getStockLabel(cenefa.stock)}</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{cenefa.stock} {cenefa.sale_unit === 'pieza' ? 'piezas' : 'cajas'}</span>
                </div>
                <CenefaBodegaStockControl cenefaId={cenefa.id} initialStock={bodegaStock || []} />
              </div>
            </div>
          </div>

          {cenefa.description && (
            <div className="card">
              <div className="card-body">
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Descripción</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{cenefa.description}</p>
              </div>
            </div>
          )}

          {cenefa.sqm_per_box && (
            <ProductCalculator
              saleUnit={cenefa.sale_unit ?? 'caja'}
              sqmPerBox={cenefa.sqm_per_box}
              piecesPerBox={cenefa.pieces_per_box}
              pricePerSqm={cenefa.price_per_sqm}
              pricePerBox={cenefa.price_per_box}
              sizeWidth={(cenefa.size as any)?.width ?? null}
              sizeHeight={(cenefa.size as any)?.height ?? null}
            />
          )}
        </div>
      </div>
    </div>
  )
}
