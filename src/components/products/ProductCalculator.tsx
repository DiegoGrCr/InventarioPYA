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

const JOINT_OPTIONS = [
  { value: 3,   label: '3 mm' },
  { value: 2,   label: '2 mm' },
  { value: 1,   label: '1 mm' },
  { value: 0.5, label: 'A hueso' },
]

// Calibrada contra etiqueta del bote (5 kg, separación 3 mm):
// 20×20→12 m², 40×40→22 m², 60×60→30 m²
function calcGroutKgPerSqm(widthCm: number, heightCm: number, jointMm: number): number {
  return 4.58 * (widthCm + heightCm) / (widthCm * heightCm) * (jointMm / 3)
}

export default function ProductCalculator({
  saleUnit, sqmPerBox, piecesPerBox, pricePerSqm, pricePerBox,
  sizeWidth, sizeHeight, material,
}: ProductCalculatorProps) {
  const [metros, setMetros] = useState('')
  const [useWaste, setUseWaste] = useState(false)
  const [wastePercent, setWastePercent] = useState('10')
  const [jointMm, setJointMm] = useState(3)

  const isPieza = saleUnit === 'pieza'
  const m2Net   = parseFloat(metros) || 0
  const waste   = useWaste ? parseFloat(wastePercent) || 0 : 0
  const m2Total = m2Net > 0 ? parseFloat((m2Net * (1 + waste / 100)).toFixed(4)) : 0
  const sqm     = sqmPerBox || 0

  // ── Pisos (caja) ─────────────────────────────────────────────────────────
  const pcsBox      = piecesPerBox || 0
  const priceBox    = pricePerSqm && sqm ? pricePerSqm * sqm : 0
  const pricePiece  = priceBox && pcsBox ? priceBox / pcsBox : 0
  const m2PerPiece  = sqm && pcsBox ? sqm / pcsBox : 0

  // Opción A — solo cajas enteras (ceil), posible sobrante
  const boxesA  = !isPieza && sqm > 0 && m2Total > 0 ? Math.ceil(m2Total / sqm) : 0
  const m2A     = parseFloat((boxesA * sqm).toFixed(4))
  const excessA = parseFloat((m2A - m2Total).toFixed(4))
  const costA   = boxesA > 0 && priceBox > 0 ? boxesA * priceBox : 0

  // Opción B — cajas (floor) + piezas sueltas
  const boxesB       = !isPieza && sqm > 0 && m2Total > 0 ? Math.floor(m2Total / sqm) : 0
  const m2FromBoxesB = parseFloat((boxesB * sqm).toFixed(4))
  const m2RemB       = parseFloat((m2Total - m2FromBoxesB).toFixed(4))
  const loosePieces  = m2RemB > 0 && m2PerPiece > 0 ? Math.ceil(m2RemB / m2PerPiece) : 0
  const m2B          = parseFloat((m2FromBoxesB + loosePieces * m2PerPiece).toFixed(4))
  const excessB      = parseFloat((m2B - m2Total).toFixed(4))
  const costB        = boxesB * priceBox + loosePieces * pricePiece
  const showOptionB  = !isPieza && loosePieces > 0 && sqm > 0 && pcsBox > 0

  // ── Pisos (pieza) ────────────────────────────────────────────────────────
  const piecesNeeded  = isPieza && sqm > 0 && m2Total > 0 ? Math.ceil(m2Total / sqm) : 0
  const supplierBoxes = isPieza && pcsBox && piecesNeeded > 0 ? Math.ceil(piecesNeeded / pcsBox) : 0
  const costPieza     = pricePerBox && piecesNeeded > 0 ? piecesNeeded * pricePerBox : 0

  // ── Pegapiso ─────────────────────────────────────────────────────────────
  const adhesiveBultos = m2Total > 0 ? Math.ceil(m2Total / 2) : 0

  // ── Boquilla ─────────────────────────────────────────────────────────────
  const hasSize = sizeWidth && sizeHeight
  const groutKgPerSqm = hasSize ? calcGroutKgPerSqm(sizeWidth!, sizeHeight!, jointMm) : null
  const groutKgTotal  = groutKgPerSqm && m2Total > 0
    ? parseFloat((groutKgPerSqm * m2Total).toFixed(2))
    : null

  // Perdura — solo por caja (5 kg c/u)
  const perduraCajas = groutKgTotal ? Math.ceil(groutKgTotal / 5) : 0

  // Adhetec — por bote (5 kg) + kg sueltos
  const adhetecBotes   = groutKgTotal ? Math.floor(groutKgTotal / 5) : 0
  const adhetecKgSuelto = groutKgTotal
    ? Math.ceil(groutKgTotal - adhetecBotes * 5)
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

            {/* Área total */}
            {useWaste && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 0' }}>
                {m2Net.toFixed(2)} m² + {waste}% desperdicio = <strong style={{ color: 'var(--text)' }}>{m2Total.toFixed(2)} m²</strong>
              </div>
            )}

            {/* Pieza individual */}
            {isPieza && (
              <div style={{ background: 'var(--primary-light)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary-hover)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Piezas necesarias
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '36px', fontWeight: 800, color: 'var(--primary-hover)', lineHeight: 1 }}>{piecesNeeded}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>piezas</span>
                  {supplierBoxes > 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>≈ {supplierBoxes} {supplierBoxes === 1 ? 'caja' : 'cajas'} del proveedor</span>
                  )}
                </div>
                {costPieza > 0 && (
                  <div style={{ marginTop: '6px', fontSize: '15px', fontWeight: 700, color: 'var(--success)' }}>{formatPrice(costPieza)}</div>
                )}
              </div>
            )}

            {/* Opción A — solo cajas */}
            {!isPieza && boxesA > 0 && (
              <div style={{ border: '1px solid rgba(99,102,241,0.3)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ background: 'var(--primary-light)', padding: '7px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary-hover)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Opción A — Solo cajas completas
                  </span>
                  {excessA > 0 && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>sobran {excessA.toFixed(2)} m²</span>}
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center', minWidth: '60px' }}>
                    <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--primary-hover)', lineHeight: 1 }}>{boxesA}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>cajas</div>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <div>Cubren <strong>{m2A.toFixed(2)} m²</strong></div>
                    {pcsBox > 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{boxesA * pcsBox} piezas en total</div>}
                  </div>
                  {costA > 0 && (
                    <>
                      <div style={{ flex: 1 }} />
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--success)' }}>{formatPrice(costA)}</div>
                        {priceBox > 0 && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatPrice(priceBox)}/caja</div>}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Opción B — cajas + piezas sueltas */}
            {showOptionB && (
              <div style={{ border: '1px solid rgba(34,211,238,0.3)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ background: 'var(--accent-light)', padding: '7px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Opción B — Cajas + piezas sueltas
                  </span>
                  {excessB < 0.001 ? <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>exacto</span>
                    : <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>sobran {excessB.toFixed(2)} m²</span>}
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center', minWidth: '60px' }}>
                    <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--primary-hover)', lineHeight: 1 }}>{boxesB}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>cajas</div>
                  </div>
                  <div style={{ fontSize: '18px', color: 'var(--text-muted)', fontWeight: 300 }}>+</div>
                  <div style={{ textAlign: 'center', minWidth: '60px' }}>
                    <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{loosePieces}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>piezas sueltas</div>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <div>Cubren <strong>{m2B.toFixed(2)} m²</strong></div>
                    {m2PerPiece > 0 && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m2PerPiece.toFixed(4)} m²/pieza</div>}
                  </div>
                  {costB > 0 && (
                    <>
                      <div style={{ flex: 1 }} />
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--success)' }}>{formatPrice(costB)}</div>
                        {pricePiece > 0 && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatPrice(pricePiece)}/pieza</div>}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

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
            {hasSize && m2Total > 0 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Boquilla — separación entre piezas
                  </div>
                  <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface)', padding: '3px', borderRadius: 'var(--radius-sm)', width: 'fit-content' }}>
                    {JOINT_OPTIONS.map(o => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setJointMm(o.value)}
                        style={{
                          padding: '5px 12px', fontSize: '13px', fontWeight: 600, border: 'none',
                          borderRadius: '5px', cursor: 'pointer', transition: 'all 150ms',
                          background: jointMm === o.value ? 'var(--primary)' : 'transparent',
                          color: jointMm === o.value ? '#fff' : 'var(--text-muted)',
                          boxShadow: jointMm === o.value ? 'var(--shadow-sm)' : 'none',
                        }}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {groutKgTotal && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>{groutKgTotal} kg totales</div>}
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
