'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, Layers, Calculator, ChevronDown } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

type ProductSummary = {
  id: string
  name: string
  material: string
  sale_unit: 'caja' | 'pieza'
  sqm_per_box: number | null
  pieces_per_box: number | null
  price_per_sqm: number | null
  price_per_box: number | null
  brand: { name: string } | null
  size: { label: string } | null
}

const WASTE_OPTIONS = [
  { value: '5',  label: '5%',  desc: 'Espacios simples, sin cortes' },
  { value: '10', label: '10%', desc: 'Estándar recomendado' },
  { value: '15', label: '15%', desc: 'Cortes en diagonal' },
  { value: '20', label: '20%', desc: 'Formas irregulares' },
]

export default function CalculadoraClient({ products }: { products: ProductSummary[] }) {
  const [productSearch, setProductSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<ProductSummary | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  const [sqmPerBox, setSqmPerBox]       = useState('')
  const [piecesPerBox, setPiecesPerBox] = useState('')
  const [pricePerSqm, setPricePerSqm]   = useState('')
  const [saleUnit, setSaleUnit]         = useState<'caja' | 'pieza'>('caja')

  // Area input mode
  const [areaMode, setAreaMode] = useState<'metros' | 'dimensiones'>('metros')
  const [metros, setMetros]     = useState('')
  const [largo, setLargo]       = useState('')
  const [ancho, setAncho]       = useState('')

  // Waste is opt-in
  const [useWaste, setUseWaste]       = useState(false)
  const [wastePercent, setWastePercent] = useState('10')

  const dropdownRef = useRef<HTMLDivElement>(null)
  const metrosRef   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = products
    .filter(p => {
      if (!productSearch.trim()) return true
      const q = productSearch.toLowerCase()
      return (
        p.name.toLowerCase().includes(q) ||
        (p.brand?.name.toLowerCase().includes(q) ?? false) ||
        (p.size?.label.toLowerCase().includes(q) ?? false)
      )
    })
    .slice(0, 10)

  const selectProduct = (p: ProductSummary) => {
    setSelectedProduct(p)
    setProductSearch(p.name)
    setSqmPerBox(p.sqm_per_box?.toString() || '')
    setPiecesPerBox(p.pieces_per_box?.toString() || '')
    setPricePerSqm(p.price_per_sqm?.toString() || '')
    setSaleUnit(p.sale_unit || 'caja')
    setShowDropdown(false)
    setTimeout(() => metrosRef.current?.focus(), 50)
  }

  const clearProduct = () => {
    setSelectedProduct(null)
    setProductSearch('')
    setSqmPerBox('')
    setPiecesPerBox('')
    setPricePerSqm('')
    setSaleUnit('caja')
  }

  // ── Calculations ──────────────────────────────────────────────────────────
  const m2Net   = areaMode === 'dimensiones'
    ? (parseFloat(largo) || 0) * (parseFloat(ancho) || 0)
    : parseFloat(metros) || 0
  const waste   = useWaste ? (parseFloat(wastePercent) || 0) : 0
  const sqm     = parseFloat(sqmPerBox) || 0
  const pcsBox  = parseInt(piecesPerBox) || 0
  const price   = parseFloat(pricePerSqm) || 0

  const m2Total    = m2Net > 0 ? parseFloat((m2Net * (1 + waste / 100)).toFixed(4)) : 0
  const m2Waste    = parseFloat((m2Total - m2Net).toFixed(4))
  const m2PerPiece = sqm > 0 && pcsBox > 0 ? sqm / pcsBox : 0
  const priceBox   = price > 0 && sqm > 0 ? price * sqm : 0
  const pricePiece = priceBox > 0 && pcsBox > 0 ? priceBox / pcsBox : 0

  // Opción A — cajas enteras (ceil), posible sobrante
  const boxesA    = sqm > 0 && m2Total > 0 ? Math.ceil(m2Total / sqm) : 0
  const m2A       = parseFloat((boxesA * sqm).toFixed(4))
  const excessA   = parseFloat((m2A - m2Total).toFixed(4))
  const costA     = boxesA > 0 && priceBox > 0 ? boxesA * priceBox : 0

  // Opción B — cajas completas (floor) + piezas sueltas exactas
  const boxesB       = sqm > 0 && m2Total > 0 ? Math.floor(m2Total / sqm) : 0
  const m2FromBoxesB = parseFloat((boxesB * sqm).toFixed(4))
  const m2RemB       = parseFloat((m2Total - m2FromBoxesB).toFixed(4))
  const loosePieces  = m2RemB > 0 && m2PerPiece > 0 ? Math.ceil(m2RemB / m2PerPiece) : 0
  const m2B          = parseFloat((m2FromBoxesB + loosePieces * m2PerPiece).toFixed(4))
  const excessB      = parseFloat((m2B - m2Total).toFixed(4))
  const costB        = (boxesB * priceBox) + (loosePieces * pricePiece)

  // Show option B only when it differs from A (there are loose pieces)
  const showOptionB  = loosePieces > 0 && sqm > 0 && pcsBox > 0

  // Modo "pieza" — el material se vende por pieza individual, sqm = m² por pieza
  const isPieza        = saleUnit === 'pieza'
  const piecesNeeded   = isPieza && sqm > 0 && m2Total > 0 ? Math.ceil(m2Total / sqm) : 0
  const m2Pieza        = parseFloat((piecesNeeded * sqm).toFixed(4))
  const excessPieza    = parseFloat((m2Pieza - m2Total).toFixed(4))
  const pricePerPieza  = price > 0 && sqm > 0 ? price * sqm : 0
  const costPieza      = piecesNeeded > 0 && pricePerPieza > 0 ? piecesNeeded * pricePerPieza : 0

  const adhesive  = m2Total > 0 ? Math.ceil(m2Total / 2) : 0
  const hasResults = m2Net > 0 && sqm > 0

  return (
    <div style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Step 1: Product search ── */}
      <div className="calc-card" style={{ padding: '24px' }}>
        <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Layers size={13} /> Paso 1 — Seleccionar piso
        </p>

        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', pointerEvents: 'none' }}>
              <Search size={14} />
            </span>
            <input
              type="text"
              className="form-input"
              placeholder={products.length > 0 ? 'Buscar por nombre, marca o medida...' : 'No hay pisos registrados aún'}
              value={productSearch}
              onChange={e => { setProductSearch(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
              disabled={products.length === 0}
              style={{ paddingLeft: '36px', paddingRight: selectedProduct ? '36px' : undefined }}
            />
            {selectedProduct ? (
              <button
                onClick={clearProduct}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
              >
                <X size={14} />
              </button>
            ) : (
              <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', display: 'flex' }}>
                <ChevronDown size={14} />
              </span>
            )}
          </div>

          {showDropdown && filtered.length > 0 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', boxShadow: 'var(--shadow)', maxHeight: '280px', overflowY: 'auto' }}>
              {filtered.map(p => (
                <button
                  key={p.id}
                  onMouseDown={() => selectProduct(p)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--border-light)', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '6px', marginTop: '2px', alignItems: 'center' }}>
                      {p.brand && <span>{p.brand.name}</span>}
                      {p.brand && p.size && <span>·</span>}
                      {p.size && <span className="badge badge-accent" style={{ fontSize: '11px', padding: '1px 6px' }}>{p.size.label}</span>}
                    </div>
                  </div>
                  {p.price_per_sqm && (
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary-hover)', flexShrink: 0 }}>
                      {formatPrice(p.price_per_sqm)}/m²
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedProduct && (
          <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            <span className="badge badge-primary">{selectedProduct.material === 'ceramica' ? 'Cerámica' : 'Porcelana'}</span>
            {selectedProduct.size && <span className="badge badge-accent">{selectedProduct.size.label} cm</span>}
            {selectedProduct.brand && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedProduct.brand.name}</span>}
          </div>
        )}
      </div>

      {/* ── Step 2: Specs + area ── */}
      <div className="calc-card" style={{ padding: '24px' }}>
        <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calculator size={13} /> Paso 2 — Datos y área
        </p>

        <div className={isPieza ? 'form-row' : 'form-row-3'} style={{ marginBottom: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{isPieza ? 'm² por pieza' : 'm² por caja'}</label>
            <input type="number" className="form-input" value={sqmPerBox} onChange={e => setSqmPerBox(e.target.value)} placeholder="1.44" min="0" step="0.01" />
          </div>
          {!isPieza && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Piezas por caja</label>
              <input type="number" className="form-input" value={piecesPerBox} onChange={e => setPiecesPerBox(e.target.value)} placeholder="8" min="0" />
            </div>
          )}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Precio por m²</label>
            <input type="number" className="form-input" value={pricePerSqm} onChange={e => setPricePerSqm(e.target.value)} placeholder="250.00" min="0" step="0.01" />
          </div>
        </div>

        {/* Area mode toggle */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', background: 'var(--bg)', padding: '4px', borderRadius: 'var(--radius-sm)', width: 'fit-content' }}>
          {(['metros', 'dimensiones'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setAreaMode(mode)}
              style={{
                padding: '6px 14px', fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 200ms',
                background: areaMode === mode ? 'var(--bg-surface)' : 'transparent',
                color: areaMode === mode ? 'var(--text)' : 'var(--text-muted)',
                boxShadow: areaMode === mode ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {mode === 'metros' ? 'Ya sé los m²' : 'Ancho × Largo'}
            </button>
          ))}
        </div>

        {areaMode === 'metros' ? (
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label">Metros cuadrados a cubrir *</label>
            <input
              ref={metrosRef}
              type="number"
              className="form-input"
              value={metros}
              onChange={e => setMetros(e.target.value)}
              placeholder="16.00"
              min="0"
              step="0.01"
              style={{ fontSize: '18px', fontWeight: 700 }}
            />
          </div>
        ) : (
          <div className="form-row" style={{ marginBottom: '14px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Largo (metros)</label>
              <input
                type="number"
                className="form-input"
                value={largo}
                onChange={e => setLargo(e.target.value)}
                placeholder="4.00"
                min="0"
                step="0.01"
                style={{ fontSize: '18px', fontWeight: 700 }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Ancho (metros)</label>
              <input
                type="number"
                className="form-input"
                value={ancho}
                onChange={e => setAncho(e.target.value)}
                placeholder="4.00"
                min="0"
                step="0.01"
                style={{ fontSize: '18px', fontWeight: 700 }}
              />
            </div>
          </div>
        )}

        {areaMode === 'dimensiones' && m2Net > 0 && (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', padding: '8px 12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
            {parseFloat(largo).toFixed(2)} m × {parseFloat(ancho).toFixed(2)} m = <strong>{m2Net.toFixed(2)} m²</strong>
          </div>
        )}

        {/* Waste — optional toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={useWaste}
            onChange={e => setUseWaste(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
          />
          <span style={{ fontSize: '13px', fontWeight: 600, color: useWaste ? 'var(--text)' : 'var(--text-muted)' }}>
            Considerar desperdicio por cortes
          </span>
        </label>

        {useWaste && (
          <div className="form-group" style={{ marginBottom: 0, marginTop: '10px' }}>
            <select className="form-select" value={wastePercent} onChange={e => setWastePercent(e.target.value)}>
              {WASTE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label} — {o.desc}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Results ── */}
      {hasResults ? (
        <div className="calc-card" style={{ padding: '24px' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Resultados
          </p>

          {/* Area breakdown */}
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center', padding: '0 12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                {areaMode === 'dimensiones' ? `${parseFloat(largo).toFixed(2)} × ${parseFloat(ancho).toFixed(2)} m` : 'Área'}
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800 }}>{m2Net.toFixed(2)}<span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '3px' }}>m²</span></div>
            </div>
            {useWaste && (
              <>
                <div style={{ color: 'var(--border)', fontSize: '24px', fontWeight: 300 }}>+</div>
                <div style={{ textAlign: 'center', padding: '0 12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Desperdicio {waste}%</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--warning)' }}>{m2Waste.toFixed(2)}<span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '3px' }}>m²</span></div>
                </div>
                <div style={{ color: 'var(--border)', fontSize: '24px', fontWeight: 300 }}>=</div>
                <div style={{ textAlign: 'center', padding: '0 12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Total a comprar</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary-hover)' }}>{m2Total.toFixed(2)}<span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '3px' }}>m²</span></div>
                </div>
              </>
            )}
          </div>

          {/* ── Material vendido por pieza individual ── */}
          {isPieza && (
            <div style={{ border: '1px solid rgba(99,102,241,0.3)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ background: 'var(--primary-light)', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary-hover)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Piezas necesarias
                </span>
                {excessPieza > 0 && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    sobran {excessPieza.toFixed(2)} m²
                  </span>
                )}
              </div>
              <div style={{ padding: '14px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ textAlign: 'center', minWidth: '70px' }}>
                  <div style={{ fontSize: '42px', fontWeight: 800, color: 'var(--primary-hover)', lineHeight: 1 }}>{piecesNeeded}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>piezas</div>
                </div>
                <div style={{ color: 'var(--border)', fontSize: '20px' }}>·</div>
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cubren <strong>{m2Pieza.toFixed(2)} m²</strong></div>
                  {sqm > 0 && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sqm.toFixed(4)} m² por pieza</div>}
                </div>
                {costPieza > 0 && (
                  <>
                    <div style={{ flex: 1 }} />
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--success)' }}>{formatPrice(costPieza)}</div>
                      {pricePerPieza > 0 && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatPrice(pricePerPieza)} / pieza</div>}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Opción A: Cajas enteras ── */}
          {!isPieza && (
          <div style={{ border: '1px solid rgba(99,102,241,0.3)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '12px' }}>
            <div style={{ background: 'var(--primary-light)', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary-hover)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Opción A — Solo cajas completas
              </span>
              {excessA > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  sobran {excessA.toFixed(2)} m²
                </span>
              )}
            </div>
            <div style={{ padding: '14px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ textAlign: 'center', minWidth: '70px' }}>
                <div style={{ fontSize: '42px', fontWeight: 800, color: 'var(--primary-hover)', lineHeight: 1 }}>{boxesA}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>cajas</div>
              </div>
              <div style={{ color: 'var(--border)', fontSize: '20px' }}>·</div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cubren <strong>{m2A.toFixed(2)} m²</strong></div>
                {pcsBox > 0 && <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{boxesA * pcsBox} piezas en total</div>}
              </div>
              {costA > 0 && (
                <>
                  <div style={{ flex: 1 }} />
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--success)' }}>{formatPrice(costA)}</div>
                    {priceBox > 0 && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatPrice(priceBox)} / caja</div>}
                  </div>
                </>
              )}
            </div>
          </div>
          )}

          {/* ── Opción B: Cajas + piezas sueltas ── */}
          {!isPieza && showOptionB && (
            <div style={{ border: '1px solid rgba(34,211,238,0.3)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ background: 'var(--accent-light)', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Opción B — Cajas + piezas sueltas
                </span>
                {excessB >= 0 && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {excessB < 0.001 ? 'exacto' : `sobran ${excessB.toFixed(2)} m²`}
                  </span>
                )}
              </div>
              <div style={{ padding: '14px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ textAlign: 'center', minWidth: '70px' }}>
                  <div style={{ fontSize: '42px', fontWeight: 800, color: 'var(--primary-hover)', lineHeight: 1 }}>{boxesB}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>cajas</div>
                </div>
                <div style={{ fontSize: '18px', color: 'var(--text-muted)', fontWeight: 300 }}>+</div>
                <div style={{ textAlign: 'center', minWidth: '70px' }}>
                  <div style={{ fontSize: '42px', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{loosePieces}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>piezas sueltas</div>
                </div>
                <div style={{ color: 'var(--border)', fontSize: '20px' }}>·</div>
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cubren <strong>{m2B.toFixed(2)} m²</strong></div>
                  {m2PerPiece > 0 && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m2PerPiece.toFixed(4)} m² por pieza</div>}
                </div>
                {costB > 0 && (
                  <>
                    <div style={{ flex: 1 }} />
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--success)' }}>{formatPrice(costB)}</div>
                      {pricePiece > 0 && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatPrice(pricePiece)} / pieza</div>}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Pegapiso ── */}
          <div style={{ border: '1px solid rgba(251,191,36,0.3)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ background: 'var(--warning-light)', padding: '8px 14px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Pegapiso recomendado
              </span>
            </div>
            <div style={{ padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ textAlign: 'center', minWidth: '70px' }}>
                <div style={{ fontSize: '42px', fontWeight: 800, color: 'var(--warning)', lineHeight: 1 }}>{adhesive}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>bultos</div>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Bultos de <strong>20 kg</strong><br />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>1 bulto ≈ 2 m² · base: {m2Total.toFixed(2)} m²{useWaste ? ` (+${waste}% desperdicio)` : ''}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-muted)' }}>
          <Calculator size={52} strokeWidth={1} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontSize: '14px' }}>Ingresa los metros cuadrados para ver los resultados</p>
        </div>
      )}
    </div>
  )
}
