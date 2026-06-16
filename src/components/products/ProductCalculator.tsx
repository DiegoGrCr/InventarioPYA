'use client'

import { useState } from 'react'
import { Calculator } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

interface ProductCalculatorProps {
  saleUnit: 'caja' | 'pieza'
  sqmPerBox: number | null
  piecesPerBox: number | null
  pricePerSqm: number | null
  pricePerBox: number | null
  sizeWidth: number | null   // cm
  sizeHeight: number | null  // cm
  material: 'ceramica' | 'porcelana'
}

const WASTE_OPTIONS = [
  { value: '5',  label: '5%',  desc: 'Sin cortes' },
  { value: '10', label: '10%', desc: 'Estándar' },
  { value: '15', label: '15%', desc: 'Diagonal' },
  { value: '20', label: '20%', desc: 'Formas irregulares' },
]

function calcGroutKgPerSqm(widthCm: number, heightCm: number, material: 'ceramica' | 'porcelana') {
  const W = widthCm * 10  // mm
  const H = heightCm * 10 // mm
  const J = material === 'porcelana' ? 2 : 3   // joint width mm
  const T = material === 'porcelana' ? 10 : 8  // tile thickness mm
  const rho = 1.8  // kg/L
  const waste = 1.15
  return ((W + H) / (W * H)) * J * T * rho * waste
}

export default function ProductCalculator({
  saleUnit, sqmPerBox, piecesPerBox, pricePerSqm, pricePerBox,
  sizeWidth, sizeHeight, material,
}: ProductCalculatorProps) {
  const [metros, setMetros] = useState('')
  const [useWaste, setUseWaste] = useState(false)
  const [wastePercent, setWastePercent] = useState('10')

  const isPieza = saleUnit === 'pieza'
  const m2Net   = parseFloat(metros) || 0
  const waste   = useWaste ? parseFloat(wastePercent) || 0 : 0
  const m2Total = m2Net > 0 ? parseFloat((m2Net * (1 + waste / 100)).toFixed(4)) : 0
  const sqm     = sqmPerBox || 0

  // ── Pisos ────────────────────────────────────────────────────────────────
  const boxesNeeded  = !isPieza && sqm > 0 && m2Total > 0 ? Math.ceil(m2Total / sqm) : 0
  const piecesNeeded = isPieza  && sqm > 0 && m2Total > 0 ? Math.ceil(m2Total / sqm) : 0
  const supplierBoxes = isPieza && piecesPerBox && piecesNeeded > 0 ? Math.ceil(piecesNeeded / piecesPerBox) : 0
  const floorCost    = !isPieza && pricePerBox && boxesNeeded > 0
    ? boxesNeeded * pricePerBox
    : isPieza && pricePerBox && piecesNeeded > 0
    ? piecesNeeded * pricePerBox
    : 0

  // ── Pegapiso ─────────────────────────────────────────────────────────────
  const adhesiveBultos = m2Total > 0 ? Math.ceil(m2Total / 2) : 0

  // ── Boquilla ─────────────────────────────────────────────────────────────
  const hasSize = sizeWidth && sizeHeight
  const groutKgPerSqm = hasSize ? calcGroutKgPerSqm(sizeWidth!, sizeHeight!, material) : null
  const groutKgTotal  = groutKgPerSqm && m2Total > 0
    ? parseFloat((groutKgPerSqm * m2Total).toFixed(2))
    : null

  // Perdura — solo por caja (5 kg c/u)
  const perduraCajas = groutKgTotal ? Math.ceil(groutKgTotal / 5) : 0

  // Adhetec — por bote (5 kg) + kg sueltos
  const adhetecBotes   = groutKgTotal ? Math.floor(groutKgTotal / 5) : 0
  const adhetecKgSuelto = groutKgTotal
    ? parseFloat((groutKgTotal - adhetecBotes * 5).toFixed(1))
    : 0

  const hasResults = m2Total > 0 && sqm > 0

  return (
    <div className="card">
      <div className="card-body">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calculator size={16} /> Calculadora rápida
        </h3>

        {/* Area input */}
        <div className="form-group" style={{ marginBottom: '12px' }}>
          <label className="form-label">Metros cuadrados a cubrir</label>
          <input
            type="number"
            className="form-input"
            value={metros}
            onChange={e => setMetros(e.target.value)}
            placeholder="16.00"
            min="0"
            step="0.01"
            style={{ fontSize: '18px', fontWeight: 700, maxWidth: '200px' }}
          />
        </div>

        {/* Waste toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none', marginBottom: useWaste ? '8px' : '16px' }}>
          <input
            type="checkbox"
            checked={useWaste}
            onChange={e => setUseWaste(e.target.checked)}
            style={{ width: '15px', height: '15px', accentColor: 'var(--primary)' }}
          />
          <span style={{ fontSize: '13px', color: useWaste ? 'var(--text)' : 'var(--text-muted)' }}>
            Incluir desperdicio por cortes
          </span>
        </label>
        {useWaste && (
          <div style={{ marginBottom: '16px' }}>
            <select className="form-select" value={wastePercent} onChange={e => setWastePercent(e.target.value)} style={{ maxWidth: '220px' }}>
              {WASTE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label} — {o.desc}</option>
              ))}
            </select>
          </div>
        )}

        {/* Results */}
        {hasResults && (
          <div style={{ display: 'grid', gap: '10px' }}>

            {/* Pisos */}
            <div style={{ background: 'var(--primary-light)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary-hover)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                {isPieza ? 'Piezas necesarias' : 'Cajas necesarias'}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '36px', fontWeight: 800, color: 'var(--primary-hover)', lineHeight: 1 }}>
                  {isPieza ? piecesNeeded : boxesNeeded}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {isPieza ? 'piezas' : 'cajas'}
                </span>
                {!isPieza && piecesPerBox && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    ({boxesNeeded * piecesPerBox} piezas en total)
                  </span>
                )}
                {isPieza && supplierBoxes > 0 && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    ≈ {supplierBoxes} {supplierBoxes === 1 ? 'caja' : 'cajas'} del proveedor
                  </span>
                )}
              </div>
              {floorCost > 0 && (
                <div style={{ marginTop: '6px', fontSize: '15px', fontWeight: 700, color: 'var(--success)' }}>
                  {formatPrice(floorCost)}
                  {pricePerSqm && <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '6px' }}>{formatPrice(pricePerSqm)}/m²</span>}
                </div>
              )}
              {useWaste && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Base {m2Net.toFixed(2)} m² + {waste}% desperdicio = {m2Total.toFixed(2)} m²
                </div>
              )}
            </div>

            {/* Pegapiso */}
            <div style={{ background: 'var(--warning-light)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Pegapiso recomendado
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '30px', fontWeight: 800, color: 'var(--warning)', lineHeight: 1 }}>{adhesiveBultos}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>bultos de 20 kg</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>1 bulto ≈ 2 m²</div>
            </div>

            {/* Boquilla */}
            {groutKgTotal && groutKgTotal > 0 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ padding: '8px 16px', background: 'var(--bg)', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Boquilla recomendada — {groutKgTotal} kg totales
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)' }}>

                  {/* Perdura */}
                  <div style={{ background: 'var(--bg-surface)', padding: '12px 14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>Perdura</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{perduraCajas}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{perduraCajas === 1 ? 'caja' : 'cajas'}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>5 kg c/u · solo por caja</div>
                  </div>

                  {/* Adhetec */}
                  <div style={{ background: 'var(--bg-surface)', padding: '12px 14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>Adhetec</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      {adhetecBotes > 0 && (
                        <>
                          <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{adhetecBotes}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{adhetecBotes === 1 ? 'bote' : 'botes'}</span>
                        </>
                      )}
                      {adhetecKgSuelto > 0 && (
                        <>
                          {adhetecBotes > 0 && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>+</span>}
                          <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{adhetecKgSuelto}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>kg</span>
                        </>
                      )}
                      {adhetecBotes === 0 && adhetecKgSuelto === 0 && (
                        <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>—</span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>botes 5 kg + kg sueltos</div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {!hasResults && metros && !sqm && (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Este piso no tiene datos de m²/caja para calcular.</p>
        )}
      </div>
    </div>
  )
}
