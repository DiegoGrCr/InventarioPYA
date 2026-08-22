import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import CenefaForm from '@/components/cenefas/CenefaForm'
import Link from 'next/link'

export default async function EditarCenefaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await isAdminSession())) redirect(`/cenefas/${id}`)

  const supabase = await createServerSupabaseClient()

  const [cenefaRes, brandsRes, sizesRes, bodegaStockRes] = await Promise.all([
    supabase.from('cenefas').select('*, brand:brands(*), size:sizes(*)').eq('id', id).single(),
    supabase.from('brands').select('*').order('name'),
    supabase.from('sizes').select('*').order('width'),
    supabase.from('cenefa_bodega_stock').select('bodega, stock').eq('cenefa_id', id).order('bodega'),
  ])

  if (!cenefaRes.data) notFound()

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href={`/cenefas/${id}`} className="btn btn-ghost btn-icon">←</Link>
          <div>
            <h1>Editar Cenefa</h1>
            <p>{cenefaRes.data.name}</p>
          </div>
        </div>
      </div>
      <CenefaForm
        brands={brandsRes.data || []}
        sizes={sizesRes.data || []}
        cenefa={cenefaRes.data}
        bodegaStock={bodegaStockRes.data || []}
      />
    </div>
  )
}
