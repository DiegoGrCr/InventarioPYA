import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import ValvuleriaForm from '@/components/valvuleria/ValvuleriaForm'
import Link from 'next/link'

export default async function EditarValvuleriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await isAdminSession())) redirect(`/valvuleria/${id}`)

  const supabase = await createServerSupabaseClient()

  const [{ data: item }, { data: bodegaStock }] = await Promise.all([
    supabase.from('valvuleria').select('*').eq('id', id).single(),
    supabase.from('valvuleria_bodega_stock').select('bodega, stock').eq('valvuleria_id', id).order('bodega'),
  ])

  if (!item) notFound()

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/valvuleria" className="btn btn-ghost btn-icon">←</Link>
          <div>
            <h1>Editar Valvulería</h1>
            <p>{item.name}</p>
          </div>
        </div>
      </div>
      <ValvuleriaForm item={item} bodegaStock={bodegaStock || []} />
    </div>
  )
}
