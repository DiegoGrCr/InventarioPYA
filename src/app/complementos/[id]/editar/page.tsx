import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import AccessoryForm from '@/components/accessories/AccessoryForm'
import Link from 'next/link'

export default async function EditarAccesorioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await isAdminSession())) redirect(`/complementos/${id}`)

  const supabase = await createServerSupabaseClient()

  const { data: accessory } = await supabase
    .from('accessories')
    .select('*')
    .eq('id', id)
    .single()

  if (!accessory) notFound()

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/complementos" className="btn btn-ghost btn-icon">←</Link>
          <div>
            <h1>Editar Accesorio</h1>
            <p>{accessory.name}</p>
          </div>
        </div>
      </div>
      <AccessoryForm accessory={accessory} />
    </div>
  )
}
