import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Layers, Package, AlertTriangle, Tag, PackageOpen, Plus, Ruler, Calculator, Toilet } from 'lucide-react'

export default async function DashboardPage() {
  if (!(await isAdminSession())) redirect('/pisos')

  const supabase = await createServerSupabaseClient()

  const [productsRes, accessoriesRes, banosRes, lowStockRes, brandsRes] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('accessories').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('bano_products').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true).lte('stock', 5),
    supabase.from('brands').select('id', { count: 'exact', head: true }),
  ])

  const totalProducts = productsRes.count || 0
  const totalAccessories = accessoriesRes.count || 0
  const totalBanos = banosRes.count || 0
  const lowStock = lowStockRes.count || 0
  const totalBrands = brandsRes.count || 0

  const { data: recentProducts } = await supabase
    .from('products')
    .select('*, brand:brands(name), size:sizes(label)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(6)

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Resumen general del inventario</p>
        </div>
        <Link href="/pisos/nuevo" className="btn btn-primary"><Plus size={16} /> Nuevo Piso</Link>
      </div>

      <div className="stats-grid">
        <Link href="/pisos" className="stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="stat-icon primary"><Layers size={22} /></div>
          <div className="stat-info">
            <h3>{totalProducts}</h3>
            <p>Pisos en catálogo</p>
          </div>
        </Link>
        <Link href="/banos" className="stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="stat-icon accent"><Toilet size={22} /></div>
          <div className="stat-info">
            <h3>{totalBanos}</h3>
            <p>Baños</p>
          </div>
        </Link>
        <Link href="/complementos" className="stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="stat-icon accent"><Package size={22} /></div>
          <div className="stat-info">
            <h3>{totalAccessories}</h3>
            <p>Complementos</p>
          </div>
        </Link>
        <Link href="/inventario" className="stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="stat-icon warning"><AlertTriangle size={22} /></div>
          <div className="stat-info">
            <h3>{lowStock}</h3>
            <p>Stock bajo</p>
          </div>
        </Link>
        <Link href="/marcas" className="stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="stat-icon success"><Tag size={22} /></div>
          <div className="stat-info">
            <h3>{totalBrands}</h3>
            <p>Marcas</p>
          </div>
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Productos Recientes</h2>
        <Link href="/pisos" className="btn btn-ghost btn-sm">Ver todos →</Link>
      </div>

      {recentProducts && recentProducts.length > 0 ? (
        <div className="product-grid">
          {recentProducts.map((p) => (
            <Link key={p.id} href={`/pisos/${p.id}`} className="card fade-in" style={{ textDecoration: 'none' }}>
              <div className="card-image-wrapper">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="card-image" />
                ) : (
                  <div className="card-image-placeholder"><Layers size={48} strokeWidth={1} /></div>
                )}
                {p.size && <span className="card-image-size-badge">{(p.size as { label: string }).label}</span>}
              </div>
              <div className="card-body">
                <h3 className="card-title">{p.name}</h3>
                <div className="card-meta">
                  <span className="badge badge-primary">{p.material === 'ceramica' ? 'Cerámica' : 'Porcelana'}</span>
                </div>
                {p.brand && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{(p.brand as { name: string }).name}</p>}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><PackageOpen size={48} strokeWidth={1} /></div>
          <h3>Sin productos aún</h3>
          <p>Agrega tu primer piso al catálogo para comenzar</p>
          <Link href="/pisos/nuevo" className="btn btn-primary"><Plus size={16} /> Agregar Piso</Link>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginTop: '32px', flexWrap: 'wrap' }}>
        <Link href="/complementos/nuevo" className="btn btn-secondary"><Package size={16} /> Nuevo Complemento</Link>
        <Link href="/marcas" className="btn btn-secondary"><Tag size={16} /> Gestionar Marcas</Link>
        <Link href="/medidas" className="btn btn-secondary"><Ruler size={16} /> Gestionar Medidas</Link>
        <Link href="/calculadora" className="btn btn-secondary"><Calculator size={16} /> Calculadora</Link>
      </div>
    </div>
  )
}
