'use client'

import { useState, Suspense } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import MobileNav from '@/components/layout/MobileNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Suspense fallback={
        <header className="header">
          <div className="header-search">
            <span className="header-search-icon">🔍</span>
            <input type="text" placeholder="Buscar productos, marcas..." disabled />
          </div>
        </header>
      }>
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
      </Suspense>
      <main className="main-content">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
