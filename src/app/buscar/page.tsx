import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import { Layers, Toilet, Package, Search } from 'lucide-react'

export default async function BuscarPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const query = q?.trim() || ''

  if (!query) {
    return (
      <div className="fade-in">
        <div className="page-header">
          <div>
            <h1>Búsqueda</h1>
            <p>Escribe en el buscador para encontrar productos</p>
          </div>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon"><Search size={48} strokeWidth={1} /></div>
          <h3>¿Qué estás buscando?</h3>
          <p>Usa el buscador de arriba para encontrar pisos, baños o complementos</p>
        </div>
      </div>
    )
  }

  const supabase = await createServerSupabaseClient()
  const like = `%${query}%`

  const [pisosRes, banosRes, compRes] = await Promise.all([
    supabase.from('products')
      .select('id, name, image_url, price_per_sqm, stock, brand:brands(name), size:sizes(label)')
      .eq('is_active', true)
      .or(`name.ilike.${like},description.ilike.${like},color.ilike.${like},finish.ilike.${like}`)
      .limit(12),
    supabase.from('bano_products')
      .select('id, name, image_url, price, stock, brand, model')
      .eq('is_active', true)
      .or(`name.ilike.${like},description.ilike.${like},brand.ilike.${like},model.ilike.${like},color.ilike.${like}`)
      .limit(12),
    supabase.from('accessories')
      .select('id, name, image_url, price, stock, category, brand')
      .eq('is_active', true)
      .or(`name.ilike.${like},description.ilike.${like},brand.ilike.${like}`)
      .limit(12),
  ])

  const pisos = pisosRes.data || []
  const banos = banosRes.data || []
  const complementos = compRes.data || []
  const total = pisos.length + banos.length + complementos.length

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>Resultados para &ldquo;{query}&rdquo;</h1>
          <p>{total === 0 ? 'Sin resultados' : `${total} ${total === 1 ? 'resultado' : 'resultados'}`}</p>
        </div>
      </div>

      {total === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Search size={48} strokeWidth={1} /></div>
          <h3>Sin resultados</h3>
          <p>No se encontró ningún producto con &ldquo;{query}&rdquo;</p>
        </div>
      )}

      {pisos.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Layers size={18} />
            <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Pisos ({pisos.length})</h2>
          </div>
          <div className="product-grid">
            {pisos.map((p) => (
              <Link key={p.id} href={`/pisos/${p.id}`} className="card fade-in" style={{ textDecoration: 'none' }}>
                <div className="card-image-wrapper">
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name} className="card-image" />
                    : <div className="card-image-placeholder"><Layers size={48} strokeWidth={1} /></div>}
                  {p.size && <span className="card-image-size-badge">{(p.size as unknown as { label: string }).label}</span>}
                </div>
                <div className="card-body">
                  <h3 className="card-title">{p.name}</h3>
                  {p.brand && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{(p.brand as unknown as { name: string }).name}</p>}
                </div>
                <div className="card-footer">
                  <span style={{ fontWeight: 700 }}>
                    {p.price_per_sqm
                      ? <>{formatPrice(p.price_per_sqm)}<span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}> /m²</span></>
                      : '—'}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Stock: {p.stock}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {banos.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Toilet size={18} />
            <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Baños ({banos.length})</h2>
          </div>
          <div className="product-grid">
            {banos.map((b) => (
              <Link key={b.id} href={`/banos/${b.id}`} className="card fade-in" style={{ textDecoration: 'none' }}>
                <div className="card-image-wrapper">
                  {b.image_url
                    ? <img src={b.image_url} alt={b.name} className="card-image" />
                    : <div className="card-image-placeholder"><Toilet size={48} strokeWidth={1} /></div>}
                </div>
                <div className="card-body">
                  <h3 className="card-title">{b.name}</h3>
                  {b.brand && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{b.brand}</p>}
                  {b.model && <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mod. {b.model}</p>}
                </div>
                <div className="card-footer">
                  <span style={{ fontWeight: 700 }}>{b.price ? formatPrice(b.price) : '—'}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Stock: {b.stock}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {complementos.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Package size={18} />
            <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Complementos ({complementos.length})</h2>
          </div>
          <div className="product-grid">
            {complementos.map((c) => (
              <Link key={c.id} href={`/complementos/${c.id}`} className="card fade-in" style={{ textDecoration: 'none' }}>
                <div className="card-image-wrapper">
                  {c.image_url
                    ? <img src={c.image_url} alt={c.name} className="card-image" />
                    : <div className="card-image-placeholder"><Package size={48} strokeWidth={1} /></div>}
                </div>
                <div className="card-body">
                  <h3 className="card-title">{c.name}</h3>
                  {c.brand && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{c.brand}</p>}
                </div>
                <div className="card-footer">
                  <span style={{ fontWeight: 700 }}>{c.price ? formatPrice(c.price) : '—'}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Stock: {c.stock}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
