import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/components/layout/AppShell'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'

export const metadata: Metadata = {
  title: 'Pisos y Azulejos de Jalpan',
  description: 'Sistema de inventario para Pisos y Azulejos de Jalpan',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PYA Jalpan',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#6366f1" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
