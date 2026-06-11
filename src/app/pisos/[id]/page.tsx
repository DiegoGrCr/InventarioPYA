import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatPrice, getMaterialLabel, getStockStatus, getStockLabel } from '@/lib/utils'
import { Pencil, Layers } from 'lucide-react'
import StockControl from '@/components/products/StockControl'
import DeleteProductBtn from '@/components/products/DeleteProductBtn'

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const isAdmin = await isAdminSession()
  const supabase = await createServerSupabaseClient()

  const { data: product } = await supabase
    .from('products')
    .select('*, brand:brands(*), size:sizes(*)')
    .eq('id', id)
    .single()

  if (!product) notFound()

  const stockStatus = getStockStatus(product.stock)
  const badgeClass = stockStatus === 'available' ? 'badge-success' : stockStatus === 'low' ? 'badge-warning' : 'badge-danger'

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/pisos" className="btn btn-ghost btn-icon">←</Link>
          <div>
            <h1>{product.name}</h1>
            {product.sku && <p>SKU: {product.sku}</p>}
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href={`/pisos/${id}/editar`} className="btn btn-secondary"><Pencil size={15} /> Editar</Link>
            <DeleteProductBtn productId={id} />
          </div>
        )}
      </div>

      <div className="detail-grid">
        <div className="detail-image">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: '20px' }} />
          ) : (
            <div className="card-image-placeholder" style={{ borderRadius: 'var(--radius)', height: '100%' }}><Layers size={72} strokeWidth={1} /></div>
          )}
          {product.size && (
            <span style={{ position: 'absolute', bottom: '12px', right: '12px', background: 'rgba(10,10,15,0.75)', backdropFilter: 'blur(6px)', color: 'var(--accent)', fontSize: '13px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(34,211,238,0.3)' }}>
              {(product.size as { label: string }).label}
            </span>
          )}
        </div>

        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-body">
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Información</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Material</span>
                  <span className="badge badge-primary">{getMaterialLabel(product.material)}</span>
                </div>
                {product.brand && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Marca</span>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{(product.brand as { name: string }).name}</span>
                  </div>
                )}
                {product.size && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Medida</span>
                    <span className="badge badge-accent">{(product.size as { label: string }).label}</span>
                  </div>
                )}
                {product.finish && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Acabado</span>
                    <span style={{ fontSize: '14px' }}>{product.finish}</span>
                  </div>
                )}
                {product.color && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Color</span>
                    <span style={{ fontSize: '14px' }}>{product.color}</span>
                  </div>
                )}
                {product.bodegas && product.bodegas.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Bodega</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end' }}>
                      {product.bodegas.map((b: string) => <span key={b} className="badge badge-accent">{b}</span>)}
                    </div>
                  </div>
                )}
                {product.pieces_per_box && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Piezas/caja</span>
                    <span style={{ fontSize: '14px' }}>{product.pieces_per_box}</span>
                  </div>
                )}
                {product.sqm_per_box && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{product.sale_unit === 'pieza' ? 'm²/pieza' : 'm²/caja'}</span>
                    <span style={{ fontSize: '14px' }}>{product.sqm_per_box}</span>
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
                  {product.price_per_sqm ? formatPrice(product.price_per_sqm) : 'Sin precio'}
                </span>
                {product.price_per_sqm && <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>por m²</span>}
              </div>
              {product.price_per_box && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: product.sale_unit === 'pieza' && product.pieces_per_box ? '4px' : '16px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{formatPrice(product.price_per_box)}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{product.sale_unit === 'pieza' ? 'por pieza' : 'por caja'}</span>
                </div>
              )}
              {product.sale_unit === 'pieza' && product.price_per_box && product.pieces_per_box && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{formatPrice(product.price_per_box * product.pieces_per_box)}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>por caja ({product.pieces_per_box} piezas)</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className={`badge ${badgeClass}`} style={{ marginRight: '8px' }}>{getStockLabel(product.stock)}</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{product.stock} {product.sale_unit === 'pieza' ? 'piezas' : 'cajas'}</span>
                </div>
                <StockControl productId={product.id} initialStock={product.stock} />
              </div>
            </div>
          </div>

          {product.description && (
            <div className="card">
              <div className="card-body">
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Descripción</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{product.description}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
