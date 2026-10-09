'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAdmin } from '@/contexts/AdminContext'
import ValvuleriaForm from '@/components/valvuleria/ValvuleriaForm'

export default function NuevaValvuleriaPage() {
  const router = useRouter()
  const isAdmin = useIsAdmin()

  useEffect(() => {
    if (!isAdmin) router.replace('/valvuleria')
  }, [isAdmin, router])

  if (!isAdmin) return null

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-ghost btn-icon" onClick={() => router.back()}>←</button>
          <div>
            <h1>Nueva Valvulería</h1>
            <p>Agrega una válvula o conexión</p>
          </div>
        </div>
      </div>
      <ValvuleriaForm />
    </div>
  )
}
