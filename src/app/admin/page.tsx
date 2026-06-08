import { isAdminSession } from '@/lib/auth'
import AdminLoginForm from '@/components/admin/AdminLoginForm'
import AdminStatusCard from '@/components/admin/AdminStatusCard'
import { ShieldCheck } from 'lucide-react'

export default async function AdminPage() {
  const isAdmin = await isAdminSession()

  return (
    <div className="fade-in" style={{ maxWidth: '420px', margin: '0 auto' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldCheck size={28} />
          <div>
            <h1>Acceso administrador</h1>
            <p>Gestiona el inventario con permisos completos</p>
          </div>
        </div>
      </div>

      {isAdmin ? <AdminStatusCard /> : <AdminLoginForm />}
    </div>
  )
}
