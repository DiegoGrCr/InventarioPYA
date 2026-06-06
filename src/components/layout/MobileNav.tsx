'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Layers, Package, ClipboardList, Calculator, Toilet } from 'lucide-react'

const mobileItems = [
  { label: 'Inicio',      href: '/',            icon: LayoutDashboard },
  { label: 'Pisos',       href: '/pisos',        icon: Layers },
  { label: 'Baños',       href: '/banos',        icon: Toilet },
  { label: 'Complementos', href: '/complementos', icon: Package },
  { label: 'Inventario',  href: '/inventario',   icon: ClipboardList },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="mobile-nav">
      <div className="mobile-nav-inner">
        {mobileItems.map((item) => {
          const Icon = item.icon
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="mobile-nav-link-icon"><Icon size={20} /></span>
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
