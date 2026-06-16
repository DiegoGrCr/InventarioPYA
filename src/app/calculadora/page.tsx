import { createServerSupabaseClient } from '@/lib/supabase/server'
import CalculadoraClient from '@/components/calculadora/CalculadoraClient'

export default async function CalculadoraPage() {
  const supabase = await createServerSupabaseClient()

  const { data: products } = await supabase
    .from('products')
    .select('id, name, material, sale_unit, sqm_per_box, pieces_per_box, price_per_sqm, price_per_box, brand:brands(name), size:sizes(label, width, height)')
    .eq('is_active', true)
    .order('name')

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>Calculadora de Pisos</h1>
          <p>Calcula cajas, piezas, costo y pegapiso necesarios</p>
        </div>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <CalculadoraClient products={(products || []) as any} />
    </div>
  )
}
