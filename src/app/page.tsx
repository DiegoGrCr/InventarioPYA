import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Search, Layers, Grid3x3, Toilet, Package, ArrowRight, Calculator } from 'lucide-react'

export const revalidate = 60

const BRAND_LOGOS: Record<string, string> = {
  daltile: '/brands/daltile.png',
  porcelanite: '/brands/porcelanite.png',
  cesantoni: '/brands/cesantoni.png',
  interceramic: '/brands/interceramic.png',
  tecnopiso: '/brands/tecnopiso.png',
  vitromex: '/brands/vitromex.png',
}

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()

  const [pisosRes, mallasRes, banosRes, accRes, brandsRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, image_url, size:sizes(label)', { count: 'exact' })
      .eq('is_active', true)
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(14),
    supabase
      .from('meshes')
      .select('id, name, image_url, size:sizes(label)', { count: 'exact' })
      .eq('is_active', true)
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(14),
    supabase
      .from('bano_products')
      .select('id, name, image_url, brand', { count: 'exact' })
      .eq('is_active', true)
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(14),
    supabase
      .from('accessories')
      .select('id, name, image_url, category', { count: 'exact' })
      .eq('is_active', true)
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(14),
    supabase.from('brands').select('id, name').order('name'),
  ])

  const pisos = pisosRes.data || []
  const mallas = mallasRes.data || []
  const banos = banosRes.data || []
  const accesorios = accRes.data || []
  const brandsWithLogo = (brandsRes.data || [])
    .map(b => ({ ...b, logo: BRAND_LOGOS[b.name.toLowerCase()] }))
    .filter(b => b.logo)

  const pisosCount = pisosRes.count || 0
  const mallasCount = mallasRes.count || 0
  const banosCount = banosRes.count || 0
  const accCount = accRes.count || 0

  // Duplicamos la lista para lograr un loop infinito sin saltos
  const pisosLoop = pisos.length > 0 ? [...pisos, ...pisos] : []
  const mallasLoop = mallas.length > 0 ? [...mallas, ...mallas] : []
  const banosLoop = banos.length > 0 ? [...banos, ...banos] : []
  const accLoop = accesorios.length > 0 ? [...accesorios, ...accesorios] : []

  return (
    <div className="fade-in home-page">
      <section className="home-hero">
        <img src="/logo1.png" alt="Pisos y Azulejos de Jalpan" className="home-hero-logo" />
        <span className="home-hero-eyebrow">Pisos · Mallas · Baños · Adhesivos</span>
        <h1 className="home-hero-title">Pisos y Azulejos de Jalpan</h1>
        <p className="home-hero-subtitle">¿Qué estás buscando hoy?</p>

        <form action="/buscar" method="GET" className="home-search">
          <Search size={20} className="home-search-icon" />
          <input
            type="text"
            name="q"
            placeholder="Busca por nombre, marca, color, medida..."
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary home-search-btn">Buscar</button>
        </form>

        <div className="home-stats">
          <div className="home-stat">
            <div className="home-stat-number">{pisosCount}</div>
            <div className="home-stat-label">Pisos en catálogo</div>
          </div>
          <div className="home-stat">
            <div className="home-stat-number">{mallasCount}</div>
            <div className="home-stat-label">Mallas</div>
          </div>
          <div className="home-stat">
            <div className="home-stat-number">{banosCount}</div>
            <div className="home-stat-label">Baños</div>
          </div>
          <div className="home-stat">
            <div className="home-stat-number">{accCount}</div>
            <div className="home-stat-label">Adhesivos</div>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-label">Nuestro catálogo</div>
        <div className="home-categories">
          <Link href="/pisos" className="home-category-panel">
            {pisos[0]?.image_url && <img src={pisos[0].image_url} alt="" className="home-category-panel-img" />}
            <div className="home-category-panel-overlay" />
            <div className="home-category-panel-content">
              <span className="home-category-panel-icon"><Layers size={20} /></span>
              <span className="home-category-panel-count">{pisosCount} productos</span>
              <h3>Pisos</h3>
              <span className="home-category-panel-cta">Ver catálogo <ArrowRight size={14} /></span>
            </div>
          </Link>
          <Link href="/mallas" className="home-category-panel">
            {mallas[0]?.image_url && <img src={mallas[0].image_url} alt="" className="home-category-panel-img" />}
            <div className="home-category-panel-overlay" />
            <div className="home-category-panel-content">
              <span className="home-category-panel-icon"><Grid3x3 size={20} /></span>
              <span className="home-category-panel-count">{mallasCount} productos</span>
              <h3>Mallas</h3>
              <span className="home-category-panel-cta">Ver catálogo <ArrowRight size={14} /></span>
            </div>
          </Link>
          <Link href="/banos" className="home-category-panel">
            {banos[0]?.image_url && <img src={banos[0].image_url} alt="" className="home-category-panel-img" />}
            <div className="home-category-panel-overlay" />
            <div className="home-category-panel-content">
              <span className="home-category-panel-icon"><Toilet size={20} /></span>
              <span className="home-category-panel-count">{banosCount} productos</span>
              <h3>Baños</h3>
              <span className="home-category-panel-cta">Ver catálogo <ArrowRight size={14} /></span>
            </div>
          </Link>
          <Link href="/complementos" className="home-category-panel">
            {accesorios[0]?.image_url && <img src={accesorios[0].image_url} alt="" className="home-category-panel-img" />}
            <div className="home-category-panel-overlay" />
            <div className="home-category-panel-content">
              <span className="home-category-panel-icon"><Package size={20} /></span>
              <span className="home-category-panel-count">{accCount} productos</span>
              <h3>Adhesivos</h3>
              <span className="home-category-panel-cta">Ver catálogo <ArrowRight size={14} /></span>
            </div>
          </Link>
        </div>
      </section>

      {brandsWithLogo.length > 0 && (
        <section className="home-section">
          <div className="home-section-label">Marcas que manejamos</div>
          <div className="home-brands">
            {brandsWithLogo.map(b => (
              <Link key={b.id} href={`/pisos?brand_id=${b.id}`} className="home-brand-logo">
                <img src={b.logo} alt={b.name} />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="home-section">
        <div className="home-section-label">Herramientas</div>
        <div className="home-calc-promo">
          <div className="home-calc-promo-inner">
            <div className="home-calc-promo-icon"><Calculator size={28} /></div>
            <div className="home-calc-promo-text">
              <h3>Calculadora de Pisos</h3>
              <p>Calcula cajas, piezas, costo y pegapiso necesarios para tu proyecto en segundos.</p>
            </div>
          </div>
          <Link href="/calculadora" className="btn btn-primary btn-lg">Calcular ahora <ArrowRight size={16} /></Link>
        </div>
      </section>

      {pisosLoop.length > 0 && (
        <section className="marquee-row">
          <div className="marquee-row-label">
            <Layers size={14} /> Pisos
          </div>
          <div className="marquee-viewport">
            <div className="marquee-track" style={{ ['--duration' as string]: '52s' }}>
              {pisosLoop.map((p, i) => (
                <Link key={`${p.id}-${i}`} href={`/pisos/${p.id}`} className="card marquee-card">
                  <div className="card-image-wrapper">
                    <img src={p.image_url!} alt={p.name} className="card-image" />
                    {p.size && <span className="card-image-size-badge">{(p.size as unknown as { label: string }).label}</span>}
                  </div>
                  <div className="card-body">
                    <h3 className="card-title">{p.name}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {mallasLoop.length > 0 && (
        <section className="marquee-row">
          <div className="marquee-row-label">
            <Grid3x3 size={14} /> Mallas
          </div>
          <div className="marquee-viewport">
            <div className="marquee-track reverse" style={{ ['--duration' as string]: '56s' }}>
              {mallasLoop.map((m, i) => (
                <Link key={`${m.id}-${i}`} href={`/mallas/${m.id}`} className="card marquee-card">
                  <div className="card-image-wrapper">
                    <img src={m.image_url!} alt={m.name} className="card-image" />
                    {m.size && <span className="card-image-size-badge">{(m.size as unknown as { label: string }).label}</span>}
                  </div>
                  <div className="card-body">
                    <h3 className="card-title">{m.name}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {banosLoop.length > 0 && (
        <section className="marquee-row">
          <div className="marquee-row-label">
            <Toilet size={14} /> Baños
          </div>
          <div className="marquee-viewport">
            <div className="marquee-track reverse" style={{ ['--duration' as string]: '60s' }}>
              {banosLoop.map((b, i) => (
                <Link key={`${b.id}-${i}`} href={`/banos/${b.id}`} className="card marquee-card">
                  <div className="card-image-wrapper">
                    <img src={b.image_url!} alt={b.name} className="card-image" />
                    {b.brand && <span className="card-image-size-badge">{b.brand}</span>}
                  </div>
                  <div className="card-body">
                    <h3 className="card-title">{b.name}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {accLoop.length > 0 && (
        <section className="marquee-row">
          <div className="marquee-row-label">
            <Package size={14} /> Adhesivos
          </div>
          <div className="marquee-viewport">
            <div className="marquee-track" style={{ ['--duration' as string]: '56s' }}>
              {accLoop.map((a, i) => (
                <Link key={`${a.id}-${i}`} href={`/complementos/${a.id}`} className="card marquee-card">
                  <div className="card-image-wrapper">
                    <img src={a.image_url!} alt={a.name} className="card-image" />
                    <span className="card-image-size-badge">{a.category === 'boquilla' ? 'Boquilla' : 'Adhesivo'}</span>
                  </div>
                  <div className="card-body">
                    <h3 className="card-title">{a.name}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
