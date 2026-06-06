import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatPrice, getStockStatus, getStockLabel } from '@/lib/utils'
import { Toilet, Plus } from 'lucide-react'

export default async function BanosPage() {
  const supabase = await createServerSupabaseClient()

  const { data: banos } = await supabase
    .from('bano_products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>Baños</h1>
          <p>Tazas y accesorios de baño</p>
        </div>
        <Link href="/banos/nuevo" className="btn btn-primary"><Plus size={16} /> Nuevo Producto</Link>
      </div>

      {banos && banos.length > 0 ? (
        <div className="product-grid">
          {banos.map((bano) => {
            const ss = getStockStatus(bano.stock)
            const bc = ss === 'available' ? 'badge-success' : ss === 'low' ? 'badge-warning' : 'badge-danger'
            return (
              <Link key={bano.id} href={`/banos/${bano.id}`} className="card fade-in" style={{ textDecoration: 'none' }}>
                <div className="card-image-wrapper">
                  {bano.image_url ? (
                    <img src={bano.image_url} alt={bano.name} className="card-image" />
                  ) : (
                    <div className="card-image-placeholder"><Toilet size={48} strokeWidth={1} /></div>
                  )}
                </div>
                <div className="card-body">
                  <h3 className="card-title">{bano.name}</h3>
                  <div className="card-meta">
                    <span className={`badge ${bc}`}>{getStockLabel(bano.stock)}</span>
                    {bano.brand && <span className="badge badge-primary">{bano.brand}</span>}
                    {bano.color && <span className="badge badge-accent">{bano.color}</span>}
                  </div>
                  {bano.model && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Mod. {bano.model}</p>}
                  {bano.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bano.description}</p>}
                </div>
                <div className="card-footer">
                  <span style={{ fontWeight: 700 }}>{formatPrice(bano.price)}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Stock: {bano.stock}</span>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><Toilet size={48} strokeWidth={1} /></div>
          <h3>Sin productos de baño aún</h3>
          <p>Agrega tu primera taza de baño</p>
          <Link href="/banos/nuevo" className="btn btn-primary"><Plus size={16} /> Agregar</Link>
        </div>
      )}
    </div>
  )
}
