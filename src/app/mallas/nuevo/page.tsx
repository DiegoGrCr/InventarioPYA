import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import MeshForm from '@/components/meshes/MeshForm'
import Link from 'next/link'

export default async function NuevaMallaPage() {
  if (!(await isAdminSession())) redirect('/mallas')

  const supabase = await createServerSupabaseClient()
  const { data: brands } = await supabase.from('brands').select('*').order('name')
  const { data: sizes } = await supabase.from('sizes').select('*').order('width')

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/mallas" className="btn btn-ghost btn-icon">←</Link>
          <div>
            <h1>Nueva Malla</h1>
            <p>Agrega una nueva malla al catálogo</p>
          </div>
        </div>
      </div>
      <MeshForm brands={brands || []} sizes={sizes || []} />
    </div>
  )
}
