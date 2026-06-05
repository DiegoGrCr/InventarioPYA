import { createServerSupabaseClient } from '@/lib/supabase/server'
import SizesManager from '@/components/management/SizesManager'

export default async function MedidasPage() {
  const supabase = await createServerSupabaseClient()
  const { data: sizes } = await supabase.from('sizes').select('*').order('width').order('height')

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>Medidas</h1>
          <p>Gestiona las medidas disponibles</p>
        </div>
      </div>
      <SizesManager initialSizes={sizes || []} />
    </div>
  )
}
