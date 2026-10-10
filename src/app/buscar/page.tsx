import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice, likeSafe } from '@/lib/utils'
import { Layers, Toilet, Package, Search, Grid3x3, Rows3, Wrench } from 'lucide-react'

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
          <p>Usa el buscador de arriba para encontrar pisos, mallas, cenefas, baños, adhesivos o valvulería</p>
        </div>
      </div>
    )
  }

  const supabase = await createServerSupabaseClient()
  const like = `%${query}%`
  const likeOr = likeSafe(query)

  // Las medidas (ej. "20x20") viven en una tabla aparte (sizes), así que
  // buscamos primero los tamaños cuya etiqueta coincide para poder filtrar
  // los pisos por size_id dentro del mismo .or()
  const { data: matchingSizes } = await supabase
    .from('sizes')
    .select('id')
    .ilike('label', like)
  const sizeIds = (matchingSizes || []).map((s) => s.id)
  const sizeFilter = sizeIds.length > 0 ? `,size_id.in.(${sizeIds.join(',')})` : ''

  const [pisosRes, mallasRes, cenefasRes, banosRes, compRes, valvuleriaRes] = await Promise.all([
    supabase.from('products')
      .select('id, name, image_url, price_per_sqm, stock, brand:brands(name), size:sizes(label)')
      .eq('is_active', true)
      .or(`name.ilike.${likeOr},description.ilike.${likeOr},color.ilike.${likeOr},finish.ilike.${likeOr},sku.ilike.${likeOr}${sizeFilter}`)
      .limit(200),
    supabase.from('meshes')
      .select('id, name, image_url, price_per_sqm, stock, brand:brands(name), size:sizes(label)')
      .eq('is_active', true)
      .or(`name.ilike.${likeOr},description.ilike.${likeOr},color.ilike.${likeOr},finish.ilike.${likeOr},sku.ilike.${likeOr}${sizeFilter}`)
      .limit(200),
    supabase.from('cenefas')
      .select('id, name, image_url, price_per_sqm, stock, brand:brands(name), size:sizes(label)')
      .eq('is_active', true)
      .or(`name.ilike.${likeOr},description.ilike.${likeOr},color.ilike.${likeOr},finish.ilike.${likeOr},sku.ilike.${likeOr}${sizeFilter}`)
      .limit(200),
    supabase.from('bano_products')
      .select('id, name, image_url, price, stock, brand, model')
      .eq('is_active', true)
      .or(`name.ilike.${likeOr},description.ilike.${likeOr},brand.ilike.${likeOr},model.ilike.${likeOr},color.ilike.${likeOr}`)
      .limit(200),
    supabase.from('accessories')
      .select('id, name, image_url, price, stock, category, brand')
      .eq('is_active', true)
      .or(`name.ilike.${likeOr},description.ilike.${likeOr},brand.ilike.${likeOr},color.ilike.${likeOr},sku.ilike.${likeOr}`)
      .limit(200),
    supabase.from('valvuleria')
      .select('id, name, image_url, price, stock, brand')
      .eq('is_active', true)
      .or(`name.ilike.${likeOr},description.ilike.${likeOr},brand.ilike.${likeOr},sku.ilike.${likeOr}`)
      .limit(200),
  ])

  const pisos = pisosRes.data || []
  const mallas = mallasRes.data || []
  const cenefas = cenefasRes.data || []
  const banos = banosRes.data || []
  const complementos = compRes.data || []
  const valvuleria = valvuleriaRes.data || []
  const total = pisos.length + mallas.length + cenefas.length + banos.length + complementos.length + valvuleria.length

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
                    ? <Image src={p.image_url} alt={p.name} fill sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, 280px" loading="lazy" className="card-image" />
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

      {mallas.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Grid3x3 size={18} />
            <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Mallas ({mallas.length})</h2>
          </div>
          <div className="product-grid">
            {mallas.map((m) => (
              <Link key={m.id} href={`/mallas/${m.id}`} className="card fade-in" style={{ textDecoration: 'none' }}>
                <div className="card-image-wrapper">
                  {m.image_url
                    ? <Image src={m.image_url} alt={m.name} fill sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, 280px" loading="lazy" className="card-image" />
                    : <div className="card-image-placeholder"><Grid3x3 size={48} strokeWidth={1} /></div>}
                  {m.size && <span className="card-image-size-badge">{(m.size as unknown as { label: string }).label}</span>}
                </div>
                <div className="card-body">
                  <h3 className="card-title">{m.name}</h3>
                  {m.brand && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{(m.brand as unknown as { name: string }).name}</p>}
                </div>
                <div className="card-footer">
                  <span style={{ fontWeight: 700 }}>
                    {m.price_per_sqm
                      ? <>{formatPrice(m.price_per_sqm)}<span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}> /m²</span></>
                      : '—'}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Stock: {m.stock}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {cenefas.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Rows3 size={18} />
            <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Cenefas ({cenefas.length})</h2>
          </div>
          <div className="product-grid">
            {cenefas.map((c) => (
              <Link key={c.id} href={`/cenefas/${c.id}`} className="card fade-in" style={{ textDecoration: 'none' }}>
                <div className="card-image-wrapper">
                  {c.image_url
                    ? <Image src={c.image_url} alt={c.name} fill sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, 280px" loading="lazy" className="card-image" />
                    : <div className="card-image-placeholder"><Rows3 size={48} strokeWidth={1} /></div>}
                  {c.size && <span className="card-image-size-badge">{(c.size as unknown as { label: string }).label}</span>}
                </div>
                <div className="card-body">
                  <h3 className="card-title">{c.name}</h3>
                  {c.brand && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{(c.brand as unknown as { name: string }).name}</p>}
                </div>
                <div className="card-footer">
                  <span style={{ fontWeight: 700 }}>
                    {c.price_per_sqm
                      ? <>{formatPrice(c.price_per_sqm)}<span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}> /m²</span></>
                      : '—'}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Stock: {c.stock}</span>
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
                    ? <Image src={b.image_url} alt={b.name} fill sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, 280px" loading="lazy" className="card-image" />
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
        <section style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Package size={18} />
            <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Adhesivos ({complementos.length})</h2>
          </div>
          <div className="product-grid">
            {complementos.map((c) => (
              <Link key={c.id} href={`/complementos/${c.id}`} className="card fade-in" style={{ textDecoration: 'none' }}>
                <div className="card-image-wrapper">
                  {c.image_url
                    ? <Image src={c.image_url} alt={c.name} fill sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, 280px" loading="lazy" className="card-image" />
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

      {valvuleria.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Wrench size={18} />
            <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Valvulería ({valvuleria.length})</h2>
          </div>
          <div className="product-grid">
            {valvuleria.map((v) => (
              <Link key={v.id} href={`/valvuleria/${v.id}`} className="card fade-in" style={{ textDecoration: 'none' }}>
                <div className="card-image-wrapper">
                  {v.image_url
                    ? <Image src={v.image_url} alt={v.name} fill sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, 280px" loading="lazy" className="card-image" />
                    : <div className="card-image-placeholder"><Wrench size={48} strokeWidth={1} /></div>}
                </div>
                <div className="card-body">
                  <h3 className="card-title">{v.name}</h3>
                  {v.brand && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{v.brand}</p>}
                </div>
                <div className="card-footer">
                  <span style={{ fontWeight: 700 }}>{v.price ? formatPrice(v.price) : '—'}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Stock: {v.stock}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
