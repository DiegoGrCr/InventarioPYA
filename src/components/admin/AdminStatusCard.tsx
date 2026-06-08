'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { logoutAdmin } from '@/actions/auth'
import { CheckCircle2, Loader2, LogOut } from 'lucide-react'

export default function AdminStatusCard() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)
    await logoutAdmin()
    router.push('/pisos')
    router.refresh()
  }

  return (
    <div className="card">
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px', padding: '32px 20px' }}>
        <CheckCircle2 size={40} color="var(--success)" />
        <div>
          <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Eres administrador</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Tienes acceso completo para crear, editar y eliminar productos, y para ajustar el inventario.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={handleLogout} disabled={loading}>
          {loading ? <><Loader2 size={15} className="spin" /> Cerrando...</> : <><LogOut size={15} /> Cerrar sesión</>}
        </button>
      </div>
    </div>
  )
}
