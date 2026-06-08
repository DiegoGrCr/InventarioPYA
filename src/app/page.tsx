import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Search, Layers, Toilet, Package, ArrowRight } from 'lucide-react'

export const revalidate = 60

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()

  const [pisosRes, banosRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, image_url, size:sizes(label)')
      .eq('is_active', true)
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(14),
    supabase
      .from('bano_products')
      .select('id, name, image_url, brand')
      .eq('is_active', true)
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(14),
  ])

  const pisos = pisosRes.data || []
  const banos = banosRes.data || []

  // Duplicamos la lista para lograr un loop infinito sin saltos
  const pisosLoop = pisos.length > 0 ? [...pisos, ...pisos] : []
  const banosLoop = banos.length > 0 ? [...banos, ...banos] : []

  return (
    <div className="fade-in home-page">
      <section className="home-hero">
        <img src="/logo1.png" alt="Pisos y Azulejos de Jalpan" className="home-hero-logo" />
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

        <div className="home-quicklinks">
          <Link href="/pisos" className="home-quicklink">
            <span className="home-quicklink-icon primary"><Layers size={20} /></span>
            Pisos <ArrowRight size={14} />
          </Link>
          <Link href="/banos" className="home-quicklink">
            <span className="home-quicklink-icon accent"><Toilet size={20} /></span>
            Baños <ArrowRight size={14} />
          </Link>
          <Link href="/complementos" className="home-quicklink">
            <span className="home-quicklink-icon success"><Package size={20} /></span>
            Complementos <ArrowRight size={14} />
          </Link>
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
    </div>
  )
}
