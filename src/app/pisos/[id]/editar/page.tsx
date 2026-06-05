import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProductForm from '@/components/products/ProductForm'
import Link from 'next/link'

export default async function EditarPisoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const [productRes, brandsRes, sizesRes] = await Promise.all([
    supabase.from('products').select('*, brand:brands(*), size:sizes(*)').eq('id', id).single(),
    supabase.from('brands').select('*').order('name'),
    supabase.from('sizes').select('*').order('width'),
  ])

  if (!productRes.data) notFound()

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href={`/pisos/${id}`} className="btn btn-ghost btn-icon">←</Link>
          <div>
            <h1>Editar Piso</h1>
            <p>{productRes.data.name}</p>
          </div>
        </div>
      </div>
      <ProductForm brands={brandsRes.data || []} sizes={sizesRes.data || []} product={productRes.data} />
    </div>
  )
}
