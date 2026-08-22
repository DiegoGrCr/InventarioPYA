import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import CenefaForm from '@/components/cenefas/CenefaForm'
import Link from 'next/link'

export default async function NuevaCenefaPage() {
  if (!(await isAdminSession())) redirect('/cenefas')

  const supabase = await createServerSupabaseClient()
  const { data: brands } = await supabase.from('brands').select('*').order('name')
  const { data: sizes } = await supabase.from('sizes').select('*').order('width')

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/cenefas" className="btn btn-ghost btn-icon">←</Link>
          <div>
            <h1>Nueva Cenefa</h1>
            <p>Agrega una nueva cenefa al catálogo</p>
          </div>
        </div>
      </div>
      <CenefaForm brands={brands || []} sizes={sizes || []} />
    </div>
  )
}
