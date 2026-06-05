import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'Inventario de Pisos - Sistema de Gestión',
  description: 'Sistema de inventario para pisos cerámicos, porcelánicos, adhesivos y boquillas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
