import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import MeshForm from '@/components/meshes/MeshForm'
import Link from 'next/link'

export default async function EditarMallaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await isAdminSession())) redirect(`/mallas/${id}`)

  const supabase = await createServerSupabaseClient()

  const [meshRes, brandsRes, sizesRes, bodegaStockRes] = await Promise.all([
    supabase.from('meshes').select('*, brand:brands(*), size:sizes(*)').eq('id', id).single(),
    supabase.from('brands').select('*').order('name'),
    supabase.from('sizes').select('*').order('width'),
    supabase.from('mesh_bodega_stock').select('bodega, stock').eq('mesh_id', id).order('bodega'),
  ])

  if (!meshRes.data) notFound()

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href={`/mallas/${id}`} className="btn btn-ghost btn-icon">←</Link>
          <div>
            <h1>Editar Malla</h1>
            <p>{meshRes.data.name}</p>
          </div>
        </div>
      </div>
      <MeshForm
        brands={brandsRes.data || []}
        sizes={sizesRes.data || []}
        mesh={meshRes.data}
        bodegaStock={bodegaStockRes.data || []}
      />
    </div>
  )
}
