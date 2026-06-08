'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAdmin } from '@/contexts/AdminContext'
import BanoForm from '@/components/banos/BanoForm'

export default function NuevoBanoPage() {
  const router = useRouter()
  const isAdmin = useIsAdmin()

  useEffect(() => {
    if (!isAdmin) router.replace('/banos')
  }, [isAdmin, router])

  if (!isAdmin) return null

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-ghost btn-icon" onClick={() => router.back()}>←</button>
          <div>
            <h1>Nuevo Producto de Baño</h1>
            <p>Agrega una taza u otro artículo de baño</p>
          </div>
        </div>
      </div>
      <BanoForm />
    </div>
  )
}
