'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { loginAdmin } from '@/actions/auth'
import { Loader2, LogIn } from 'lucide-react'

export default function AdminLoginForm() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const formData = new FormData(formRef.current!)
    const result = await loginAdmin(formData)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="form-card">
      {error && (
        <div style={{ padding: '12px', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', marginBottom: '20px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Usuario</label>
        <input type="text" name="username" className="form-input" required placeholder="Usuario" autoComplete="username" />
      </div>

      <div className="form-group">
        <label className="form-label">Contraseña</label>
        <input type="password" name="password" className="form-input" required placeholder="Contraseña" autoComplete="current-password" />
      </div>

      <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
        {loading ? <><Loader2 size={15} className="spin" /> Verificando...</> : <><LogIn size={15} /> Iniciar sesión</>}
      </button>
    </form>
  )
}
