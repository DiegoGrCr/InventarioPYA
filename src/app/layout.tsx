import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/components/layout/AppShell'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import InstallPrompt from '@/components/InstallPrompt'
import { AdminProvider } from '@/contexts/AdminContext'
import { isAdminSession } from '@/lib/auth'
import { Analytics } from '@vercel/analytics/next'

export const metadata: Metadata = {
  title: 'Pisos y Azulejos de Jalpan',
  description: 'Sistema de inventario para Pisos y Azulejos de Jalpan',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PYA Jalpan',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await isAdminSession()

  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#6366f1" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <AdminProvider isAdmin={isAdmin}>
          <AppShell>{children}</AppShell>
        </AdminProvider>
        <ServiceWorkerRegistration />
        <InstallPrompt />
        <Analytics />
      </body>
    </html>
  )
}
