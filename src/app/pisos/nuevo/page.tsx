import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ProductForm from '@/components/products/ProductForm'
import Link from 'next/link'

export default async function NuevoPisoPage() {
  if (!(await isAdminSession())) redirect('/pisos')

  const supabase = await createServerSupabaseClient()
  const { data: brands } = await supabase.from('brands').select('*').order('name')
  const { data: sizes } = await supabase.from('sizes').select('*').order('width')

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/pisos" className="btn btn-ghost btn-icon">←</Link>
          <div>
            <h1>Nuevo Piso</h1>
            <p>Agrega un nuevo producto al catálogo</p>
          </div>
        </div>
      </div>
      <ProductForm brands={brands || []} sizes={sizes || []} />
    </div>
  )
}
