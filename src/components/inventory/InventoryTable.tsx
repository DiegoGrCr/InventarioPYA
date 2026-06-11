'use client'

import { useState } from 'react'
import { updateProductStock } from '@/actions/products'
import { updateBanoStock } from '@/actions/banos'
import { updateAccessoryStock } from '@/actions/accessories'
import { getStockStatus } from '@/lib/utils'
import { Layers, Toilet, Package, FileSpreadsheet, Loader2 } from 'lucide-react'

type ExportScope = 'all' | 'brand' | 'size'
type PisosOrderBy = 'name' | 'brand' | 'size'

interface InventoryTableProps {
  products: Array<{
    id: string
    name: string
    stock: number
    sku: string | null
    material: string
    brand_id: string | null
    size_id: string | null
    bodegas: string[] | null
    sale_unit: 'caja' | 'pieza'
    price_per_sqm: number | null
    price_per_box: number | null
    sqm_per_box: number | null
    pieces_per_box: number | null
    brand: { name: string } | null
    size: { label: string } | null
  }>
  banos: Array<{
    id: string
    name: string
    stock: number
    brand: string | null
    model: string | null
    color: string | null
    bodegas: string[] | null
    price: number | null
  }>
  accessories: Array<{ id: string; name: string; stock: number; category: string; bodegas: string[] | null }>
  brands: Array<{ id: string; name: string }>
  sizes: Array<{ id: string; label: string }>
}

const fmtBodegas = (bodegas: string[] | null) => (bodegas && bodegas.length > 0 ? bodegas.join(', ') : '')

export default function InventoryTable({ products, banos, accessories, brands, sizes }: InventoryTableProps) {
  const [tab, setTab] = useState<'pisos' | 'banos' | 'accesorios'>('pisos')
  const [stocks, setStocks] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    products.forEach(p => { map[p.id] = p.stock })
    banos.forEach(b => { map[b.id] = b.stock })
    accessories.forEach(a => { map[a.id] = a.stock })
    return map
  })
  const [saving, setSaving] = useState<string | null>(null)
  const [exportScope, setExportScope] = useState<ExportScope>('all')
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [selectedSizeId, setSelectedSizeId] = useState('')
  const [pisosOrderBy, setPisosOrderBy] = useState<PisosOrderBy>('name')
  const [exporting, setExporting] = useState(false)

  const updateStock = async (id: string, newStock: number, type: 'product' | 'bano' | 'accessory') => {
    if (newStock < 0) return
    setStocks(prev => ({ ...prev, [id]: newStock }))
    setSaving(id)
    if (type === 'product') await updateProductStock(id, newStock)
    else if (type === 'bano') await updateBanoStock(id, newStock)
    else await updateAccessoryStock(id, newStock)
    setSaving(null)
  }

  const badgeForStock = (stock: number) => {
    const s = getStockStatus(stock)
    return s === 'available' ? 'badge-success' : s === 'low' ? 'badge-warning' : 'badge-danger'
  }

  const exportToExcel = async () => {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')

      let filtered = products
      if (exportScope === 'brand' && selectedBrandId) {
        filtered = products.filter(p => p.brand_id === selectedBrandId)
      } else if (exportScope === 'size' && selectedSizeId) {
        filtered = products.filter(p => p.size_id === selectedSizeId)
      }

      const sortedPisos = [...filtered].sort((a, b) => {
        if (pisosOrderBy === 'brand') return (a.brand?.name || '').localeCompare(b.brand?.name || '')
        if (pisosOrderBy === 'size') return (a.size?.label || '').localeCompare(b.size?.label || '')
        return a.name.localeCompare(b.name)
      })

      const pisosRows = sortedPisos.map(p => {
        const currentStock = stocks[p.id]
        const isPieza = p.sale_unit === 'pieza'
        return {
          'Producto': p.name,
          'SKU': p.sku || '',
          'Material': p.material === 'ceramica' ? 'Cerámica' : 'Porcelana',
          'Marca': p.brand?.name || '',
          'Medida': p.size?.label || '',
          'Bodega': fmtBodegas(p.bodegas),
          'Unidad': isPieza ? 'Pieza' : 'Caja',
          'Stock': currentStock,
          'm²/unidad': p.sqm_per_box ?? '',
          'Total m² en stock': p.sqm_per_box ? parseFloat((currentStock * p.sqm_per_box).toFixed(2)) : '',
          'Precio/m²': p.price_per_sqm ?? '',
          'Precio/unidad': p.price_per_box ?? '',
          'Piezas/caja proveedor': isPieza ? (p.pieces_per_box ?? '') : '',
          'Precio/caja proveedor': isPieza && p.price_per_box && p.pieces_per_box
            ? parseFloat((p.price_per_box * p.pieces_per_box).toFixed(2))
            : '',
        }
      })

      const banosRows = banos.map(b => ({
        'Producto': b.name,
        'Marca': b.brand || '',
        'Modelo': b.model || '',
        'Color': b.color || '',
        'Bodega': fmtBodegas(b.bodegas),
        'Stock (piezas)': stocks[b.id],
        'Precio': b.price ?? '',
      }))

      const accesoriosRows = accessories.map(a => ({
        'Producto': a.name,
        'Categoría': a.category === 'adhesivo' ? 'Adhesivo' : 'Boquilla',
        'Bodega': fmtBodegas(a.bodegas),
        'Stock (unidades)': stocks[a.id],
      }))

      const wb = XLSX.utils.book_new()

      const wsPisos = XLSX.utils.json_to_sheet(pisosRows.length > 0 ? pisosRows : [{ 'Producto': 'Sin resultados' }])
      XLSX.utils.book_append_sheet(wb, wsPisos, 'Pisos')

      const wsBanos = XLSX.utils.json_to_sheet(banosRows.length > 0 ? banosRows : [{ 'Producto': 'Sin resultados' }])
      XLSX.utils.book_append_sheet(wb, wsBanos, 'Baños')

      const wsAccesorios = XLSX.utils.json_to_sheet(accesoriosRows.length > 0 ? accesoriosRows : [{ 'Producto': 'Sin resultados' }])
      XLSX.utils.book_append_sheet(wb, wsAccesorios, 'Adhesivos')

      let filename = 'inventario_general.xlsx'
      if (exportScope === 'brand' && selectedBrandId) {
        const brand = brands.find(b => b.id === selectedBrandId)
        filename = `inventario_${(brand?.name || 'marca').replace(/\s+/g, '_')}.xlsx`
      } else if (exportScope === 'size' && selectedSizeId) {
        const size = sizes.find(s => s.id === selectedSizeId)
        filename = `inventario_${(size?.label || 'medida').replace(/\s+/g, '_')}.xlsx`
      }

      XLSX.writeFile(wb, filename)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      {/* Export section */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px', padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Descargar Excel:</span>
        <select
          className="form-select"
          style={{ fontSize: '13px', padding: '6px 10px', width: 'auto' }}
          value={exportScope}
          onChange={e => { setExportScope(e.target.value as ExportScope); setSelectedBrandId(''); setSelectedSizeId('') }}
        >
          <option value="all">Todos los pisos</option>
          <option value="brand">Por marca</option>
          <option value="size">Por medida</option>
        </select>
        {exportScope === 'brand' && (
          <select
            className="form-select"
            style={{ fontSize: '13px', padding: '6px 10px', width: 'auto' }}
            value={selectedBrandId}
            onChange={e => setSelectedBrandId(e.target.value)}
          >
            <option value="">Seleccionar marca...</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        {exportScope === 'size' && (
          <select
            className="form-select"
            style={{ fontSize: '13px', padding: '6px 10px', width: 'auto' }}
            value={selectedSizeId}
            onChange={e => setSelectedSizeId(e.target.value)}
          >
            <option value="">Seleccionar medida...</option>
            {sizes.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        )}
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Pisos ordenados por:</span>
        <select
          className="form-select"
          style={{ fontSize: '13px', padding: '6px 10px', width: 'auto' }}
          value={pisosOrderBy}
          onChange={e => setPisosOrderBy(e.target.value as PisosOrderBy)}
        >
          <option value="name">Nombre</option>
          <option value="brand">Marca</option>
          <option value="size">Medida</option>
        </select>
        <button
          className="btn btn-secondary"
          style={{ fontSize: '13px', padding: '6px 14px' }}
          onClick={exportToExcel}
          disabled={exporting || (exportScope === 'brand' && !selectedBrandId) || (exportScope === 'size' && !selectedSizeId)}
        >
          {exporting ? <><Loader2 size={14} className="spin" /> Generando...</> : <><FileSpreadsheet size={14} /> Descargar Excel</>}
        </button>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'pisos' ? 'active' : ''}`} onClick={() => setTab('pisos')}><Layers size={15} /> Pisos ({products.length})</button>
        <button className={`tab ${tab === 'banos' ? 'active' : ''}`} onClick={() => setTab('banos')}><Toilet size={15} /> Baños ({banos.length})</button>
        <button className={`tab ${tab === 'accesorios' ? 'active' : ''}`} onClick={() => setTab('accesorios')}><Package size={15} /> Adhesivos ({accessories.length})</button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Producto</th>
              {tab === 'pisos' && <><th>Marca</th><th>Medida</th><th>Precio/m²</th></>}
              {tab === 'banos' && <><th>Marca</th><th>Modelo</th></>}
              {tab === 'accesorios' && <th>Categoría</th>}
              <th>Bodega</th>
              <th>Estado</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {tab === 'pisos' && products.map(p => (
                <tr key={p.id}>
                  <td style={{ color: 'var(--text)', fontWeight: 500 }}>{p.name}</td>
                  <td>{p.brand?.name || '—'}</td>
                  <td>{p.size?.label || '—'}</td>
                  <td style={{ fontSize: '13px' }}>
                    {p.price_per_sqm
                      ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.price_per_sqm)
                      : '—'}
                  </td>
                  <td style={{ fontSize: '13px' }}>{fmtBodegas(p.bodegas) || '—'}</td>
                  <td><span className={`badge ${badgeForStock(stocks[p.id])}`}>{stocks[p.id]} {p.sale_unit === 'pieza' ? 'piezas' : 'cajas'}</span></td>
                  <td>
                    <div className="stock-control">
                      <button className="stock-btn" onClick={() => updateStock(p.id, stocks[p.id] - 1, 'product')} disabled={saving === p.id}>−</button>
                      <span className="stock-value" style={{ opacity: saving === p.id ? 0.5 : 1 }}>{stocks[p.id]}</span>
                      <button className="stock-btn" onClick={() => updateStock(p.id, stocks[p.id] + 1, 'product')} disabled={saving === p.id}>+</button>
                    </div>
                  </td>
                </tr>
            ))}
            {tab === 'banos' && banos.map(b => (
              <tr key={b.id}>
                <td style={{ color: 'var(--text)', fontWeight: 500 }}>{b.name}</td>
                <td>{b.brand || '—'}</td>
                <td>{b.model || '—'}</td>
                <td style={{ fontSize: '13px' }}>{fmtBodegas(b.bodegas) || '—'}</td>
                <td><span className={`badge ${badgeForStock(stocks[b.id])}`}>{stocks[b.id]} piezas</span></td>
                <td>
                  <div className="stock-control">
                    <button className="stock-btn" onClick={() => updateStock(b.id, stocks[b.id] - 1, 'bano')} disabled={saving === b.id}>−</button>
                    <span className="stock-value" style={{ opacity: saving === b.id ? 0.5 : 1 }}>{stocks[b.id]}</span>
                    <button className="stock-btn" onClick={() => updateStock(b.id, stocks[b.id] + 1, 'bano')} disabled={saving === b.id}>+</button>
                  </div>
                </td>
              </tr>
            ))}
            {tab === 'accesorios' && accessories.map(a => (
              <tr key={a.id}>
                <td style={{ color: 'var(--text)', fontWeight: 500 }}>{a.name}</td>
                <td><span className="badge badge-accent">{a.category === 'adhesivo' ? 'Adhesivo' : 'Boquilla'}</span></td>
                <td style={{ fontSize: '13px' }}>{fmtBodegas(a.bodegas) || '—'}</td>
                <td><span className={`badge ${badgeForStock(stocks[a.id])}`}>{stocks[a.id]} unidades</span></td>
                <td>
                  <div className="stock-control">
                    <button className="stock-btn" onClick={() => updateStock(a.id, stocks[a.id] - 1, 'accessory')} disabled={saving === a.id}>−</button>
                    <span className="stock-value" style={{ opacity: saving === a.id ? 0.5 : 1 }}>{stocks[a.id]}</span>
                    <button className="stock-btn" onClick={() => updateStock(a.id, stocks[a.id] + 1, 'accessory')} disabled={saving === a.id}>+</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
