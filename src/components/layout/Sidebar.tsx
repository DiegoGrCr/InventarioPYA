'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Layers, Package, ClipboardList,
  Tag, Ruler, Calculator, Toilet,
} from 'lucide-react'

const navItems = [
  { label: 'Dashboard',   href: '/',            icon: LayoutDashboard },
  { section: 'Catálogo' },
  { label: 'Pisos',       href: '/pisos',        icon: Layers },
  { label: 'Baños',       href: '/banos',        icon: Toilet },
  { label: 'Complementos', href: '/complementos', icon: Package },
  { section: 'Gestión' },
  { label: 'Inventario',  href: '/inventario',  icon: ClipboardList },
  { label: 'Marcas',      href: '/marcas',      icon: Tag },
  { label: 'Medidas',     href: '/medidas',     icon: Ruler },
  { section: 'Herramientas' },
  { label: 'Calculadora', href: '/calculadora', icon: Calculator },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <Image src="/logo1.png" alt="Logo" width={36} height={36} style={{ borderRadius: '8px', objectFit: 'contain', flexShrink: 0 }} />
          <div>
            <h1>Pisos y Azulejos</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, marginTop: '1px' }}>de Jalpan</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item, i) => {
            if ('section' in item) {
              return <div key={i} className="sidebar-section-title">{item.section}</div>
            }
            const Icon = item.icon!
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href!)
            return (
              <Link
                key={item.href}
                href={item.href!}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <span className="sidebar-link-icon"><Icon size={16} /></span>
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
