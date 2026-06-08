'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAdmin } from '@/contexts/AdminContext'
import AccessoryForm from '@/components/accessories/AccessoryForm'

export default function NuevoAccesorioPage() {
  const router = useRouter()
  const isAdmin = useIsAdmin()

  useEffect(() => {
    if (!isAdmin) router.replace('/complementos')
  }, [isAdmin, router])

  if (!isAdmin) return null

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-ghost btn-icon" onClick={() => router.back()}>←</button>
          <div>
            <h1>Nuevo Accesorio</h1>
            <p>Agrega un adhesivo o boquilla</p>
          </div>
        </div>
      </div>
      <AccessoryForm />
    </div>
  )
}
