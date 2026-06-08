import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import BanoForm from '@/components/banos/BanoForm'
import Link from 'next/link'

export default async function EditarBanoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await isAdminSession())) redirect(`/banos/${id}`)

  const supabase = await createServerSupabaseClient()

  const { data: bano } = await supabase
    .from('bano_products')
    .select('*')
    .eq('id', id)
    .single()

  if (!bano) notFound()

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href={`/banos/${id}`} className="btn btn-ghost btn-icon">←</Link>
          <div>
            <h1>Editar Producto</h1>
            <p>{bano.name}</p>
          </div>
        </div>
      </div>
      <BanoForm bano={bano} />
    </div>
  )
}
