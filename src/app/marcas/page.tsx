import { createServerSupabaseClient } from '@/lib/supabase/server'
import BrandsManager from '@/components/management/BrandsManager'

export default async function MarcasPage() {
  const supabase = await createServerSupabaseClient()
  const { data: brands } = await supabase.from('brands').select('*').order('name')

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>Marcas</h1>
          <p>Gestiona las marcas disponibles</p>
        </div>
      </div>
      <BrandsManager initialBrands={brands || []} />
    </div>
  )
}
