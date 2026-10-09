import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice, getStockStatus, getStockLabel } from '@/lib/utils'
import { Wrench, Plus } from 'lucide-react'

export default async function ValvuleriaPage() {
  const isAdmin = await isAdminSession()
  const supabase = await createServerSupabaseClient()

  const { data: items } = await supabase
    .from('valvuleria')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>Valvulería</h1>
          <p>Válvulas y conexiones de plomería</p>
        </div>
        {isAdmin && <Link href="/valvuleria/nuevo" className="btn btn-primary"><Plus size={16} /> Nueva Valvulería</Link>}
      </div>

      {items && items.length > 0 ? (
        <div className="product-grid">
          {items.map((it) => {
            const ss = getStockStatus(it.stock)
            const bc = ss === 'available' ? 'badge-success' : ss === 'low' ? 'badge-warning' : 'badge-danger'
            return (
              <Link key={it.id} href={`/valvuleria/${it.id}`} className="card fade-in" style={{ textDecoration: 'none' }}>
                <div className="card-image-wrapper">
                  {it.image_url ? (
                    <Image src={it.image_url} alt={it.name} fill sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, 280px" loading="lazy" className="card-image" />
                  ) : (
                    <div className="card-image-placeholder"><Wrench size={48} strokeWidth={1} /></div>
                  )}
                </div>
                <div className="card-body">
                  <h3 className="card-title">{it.name}</h3>
                  <div className="card-meta">
                    <span className={`badge ${bc}`}>{getStockLabel(it.stock)}</span>
                  </div>
                  {it.brand && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{it.brand}</p>}
                  {it.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.description}</p>}
                </div>
                <div className="card-footer">
                  <span style={{ fontWeight: 700 }}>{formatPrice(it.price)}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Stock: {it.stock}</span>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><Wrench size={48} strokeWidth={1} /></div>
          <h3>Sin valvulería aún</h3>
          <p>Agrega tu primer producto</p>
          {isAdmin && <Link href="/valvuleria/nuevo" className="btn btn-primary"><Plus size={16} /> Agregar</Link>}
        </div>
      )}
    </div>
  )
}
