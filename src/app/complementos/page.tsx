import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import Link from 'next/link'
import { formatPrice, getStockStatus, getStockLabel, getCategoryLabel } from '@/lib/utils'
import AccessoryTabs from '@/components/accessories/AccessoryTabs'
import { Droplets, PaintBucket, Plus } from 'lucide-react'

export default async function AccesoriosPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams
  const tab = params.tab || 'adhesivo'
  const isAdmin = await isAdminSession()
  const supabase = await createServerSupabaseClient()

  const { data: accessories } = await supabase
    .from('accessories')
    .select('*')
    .eq('is_active', true)
    .eq('category', tab)
    .order('created_at', { ascending: false })

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>Adhesivos</h1>
          <p>Adhesivos y boquillas</p>
        </div>
        {isAdmin && <Link href="/complementos/nuevo" className="btn btn-primary"><Plus size={16} /> Nuevo Accesorio</Link>}
      </div>

      <AccessoryTabs currentTab={tab} />

      {accessories && accessories.length > 0 ? (
        <div className="product-grid">
          {accessories.map((acc) => {
            const ss = getStockStatus(acc.stock)
            const bc = ss === 'available' ? 'badge-success' : ss === 'low' ? 'badge-warning' : 'badge-danger'
            return (
              <Link key={acc.id} href={`/complementos/${acc.id}`} className="card fade-in" style={{ textDecoration: 'none' }}>
                <div className="card-image-wrapper">
                  {acc.image_url ? (
                    <img src={acc.image_url} alt={acc.name} className="card-image" />
                  ) : (
                    <div className="card-image-placeholder">{tab === 'adhesivo' ? <Droplets size={48} strokeWidth={1} /> : <PaintBucket size={48} strokeWidth={1} />}</div>
                  )}
                </div>
                <div className="card-body">
                  <h3 className="card-title">{acc.name}</h3>
                  <div className="card-meta">
                    <span className="badge badge-accent">{getCategoryLabel(acc.category)}</span>
                    <span className={`badge ${bc}`}>{getStockLabel(acc.stock)}</span>
                    {acc.weight && <span className="badge badge-primary">{acc.weight}</span>}
                  </div>
                  {acc.brand && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{acc.brand}</p>}
                  {acc.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acc.description}</p>}
                </div>
                <div className="card-footer">
                  <span style={{ fontWeight: 700 }}>{formatPrice(acc.price)}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Stock: {acc.stock}</span>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">{tab === 'adhesivo' ? <Droplets size={48} strokeWidth={1} /> : <PaintBucket size={48} strokeWidth={1} />}</div>
          <h3>Sin {tab === 'adhesivo' ? 'adhesivos' : 'boquillas'} aún</h3>
          <p>Agrega tu primer {tab === 'adhesivo' ? 'adhesivo' : 'boquilla'}</p>
          {isAdmin && <Link href="/complementos/nuevo" className="btn btn-primary"><Plus size={16} /> Agregar</Link>}
        </div>
      )}
    </div>
  )
}
