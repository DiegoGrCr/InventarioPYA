'use client'

import { useState, Fragment } from 'react'
import { updateProductsPriceBulk, adjustProductBodegaStock } from '@/actions/products'
import { updateMeshesPriceBulk, adjustMeshBodegaStock } from '@/actions/meshes'
import { updateBanoStock } from '@/actions/banos'
import { adjustAccessoryBodegaStock } from '@/actions/accessories'
import { getStockStatus } from '@/lib/utils'
import { WAREHOUSES } from '@/lib/types'
import { Layers, Grid3x3, Toilet, Package, FileSpreadsheet, Loader2, Tag, ChevronRight, ChevronDown } from 'lucide-react'

type ExportScope = 'all' | 'brand' | 'size' | 'bodega'
type BodegaRow = { bodega: string; stock: number }

interface CatalogItem {
  id: string
  name: string
  stock: number
  sku: string | null
  brand_id: string | null
  size_id: string | null
  sale_unit: 'caja' | 'pieza'
  price_per_sqm: number | null
  price_per_box: number | null
  sqm_per_box: number | null
  pieces_per_box: number | null
  brand: { name: string } | null
  size: { label: string; width: number; height: number } | null
}

interface InventoryTableProps {
  products: Array<CatalogItem & { material: string }>
  meshes: CatalogItem[]
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
  sizes: Array<{ id: string; label: string; width: number; height: number }>
  bodegaStockByProduct: Record<string, BodegaRow[]>
  bodegaStockByMesh: Record<string, BodegaRow[]>
  bodegaStockByAccessory: Record<string, BodegaRow[]>
}

const fmtBodegas = (bodegas: string[] | null) => (bodegas && bodegas.length > 0 ? bodegas.join(', ') : '')

export default function InventoryTable({ products, meshes, banos, accessories, brands, sizes, bodegaStockByProduct, bodegaStockByMesh, bodegaStockByAccessory }: InventoryTableProps) {
  const [tab, setTab] = useState<'pisos' | 'mallas' | 'banos' | 'accesorios'>('pisos')
  const [stocks, setStocks] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    products.forEach(p => { map[p.id] = p.stock })
    meshes.forEach(m => { map[m.id] = m.stock })
    banos.forEach(b => { map[b.id] = b.stock })
    accessories.forEach(a => { map[a.id] = a.stock })
    return map
  })
  const [bodegaMap, setBodegaMap] = useState<Record<string, BodegaRow[]>>(bodegaStockByProduct)
  const [meshBodegaMap, setMeshBodegaMap] = useState<Record<string, BodegaRow[]>>(bodegaStockByMesh)
  const [accessoryBodegaMap, setAccessoryBodegaMap] = useState<Record<string, BodegaRow[]>>(bodegaStockByAccessory)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState<string | null>(null)
  const [exportScope, setExportScope] = useState<ExportScope>('all')
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [selectedSizeId, setSelectedSizeId] = useState('')
  const [selectedBodega, setSelectedBodega] = useState('')
  const [exporting, setExporting] = useState(false)

  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkPrice, setBulkPrice] = useState('')
  const [applyingBulk, setApplyingBulk] = useState(false)
  const [filterBrandId, setFilterBrandId] = useState('')
  const [filterSizeId, setFilterSizeId] = useState('')

  const [selectedMeshIds, setSelectedMeshIds] = useState<Set<string>>(new Set())
  const [bulkPriceMesh, setBulkPriceMesh] = useState('')
  const [applyingBulkMesh, setApplyingBulkMesh] = useState(false)
  const [filterBrandIdMesh, setFilterBrandIdMesh] = useState('')
  const [filterSizeIdMesh, setFilterSizeIdMesh] = useState('')

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const filteredProducts = products.filter(p =>
    (!filterBrandId || p.brand_id === filterBrandId) &&
    (!filterSizeId || p.size_id === filterSizeId)
  )

  const filteredMeshes = meshes.filter(m =>
    (!filterBrandIdMesh || m.brand_id === filterBrandIdMesh) &&
    (!filterSizeIdMesh || m.size_id === filterSizeIdMesh)
  )

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 3500)
  }

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectedMesh = (id: string) => {
    setSelectedMeshIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedIds.has(p.id))
  const allFilteredMeshesSelected = filteredMeshes.length > 0 && filteredMeshes.every(m => selectedMeshIds.has(m.id))

  const toggleSelectAllPisos = () => {
    setSelectedIds(prev => {
      if (allFilteredSelected) {
        const next = new Set(prev)
        filteredProducts.forEach(p => next.delete(p.id))
        return next
      }
      const next = new Set(prev)
      filteredProducts.forEach(p => next.add(p.id))
      return next
    })
  }

  const toggleSelectAllMallas = () => {
    setSelectedMeshIds(prev => {
      if (allFilteredMeshesSelected) {
        const next = new Set(prev)
        filteredMeshes.forEach(m => next.delete(m.id))
        return next
      }
      const next = new Set(prev)
      filteredMeshes.forEach(m => next.add(m.id))
      return next
    })
  }

  const applyBulkPrice = async () => {
    const newPrice = parseFloat(bulkPrice)
    if (!newPrice || newPrice <= 0 || selectedIds.size === 0) return

    const targets = products.filter(p => selectedIds.has(p.id))
    if (!confirm(`¿Aplicar $${newPrice.toFixed(2)}/m² a ${targets.length} producto(s) seleccionado(s)?`)) return

    setApplyingBulk(true)
    const res = await updateProductsPriceBulk(
      targets.map(p => ({ id: p.id, price_per_sqm: newPrice, sqm_per_box: p.sqm_per_box }))
    )
    setApplyingBulk(false)

    if (res.error) {
      showFeedback('error', res.error)
      return
    }

    setPriceOverrides(prev => {
      const next = { ...prev }
      targets.forEach(p => { next[p.id] = newPrice })
      return next
    })
    showFeedback('success', `Precio actualizado en ${targets.length} producto(s)`)
    setSelectedIds(new Set())
    setBulkPrice('')
  }

  const applyBulkPriceMesh = async () => {
    const newPrice = parseFloat(bulkPriceMesh)
    if (!newPrice || newPrice <= 0 || selectedMeshIds.size === 0) return

    const targets = meshes.filter(m => selectedMeshIds.has(m.id))
    if (!confirm(`¿Aplicar $${newPrice.toFixed(2)}/m² a ${targets.length} malla(s) seleccionada(s)?`)) return

    setApplyingBulkMesh(true)
    const res = await updateMeshesPriceBulk(
      targets.map(m => ({ id: m.id, price_per_sqm: newPrice, sqm_per_box: m.sqm_per_box }))
    )
    setApplyingBulkMesh(false)

    if (res.error) {
      showFeedback('error', res.error)
      return
    }

    setPriceOverrides(prev => {
      const next = { ...prev }
      targets.forEach(m => { next[m.id] = newPrice })
      return next
    })
    showFeedback('success', `Precio actualizado en ${targets.length} malla(s)`)
    setSelectedMeshIds(new Set())
    setBulkPriceMesh('')
  }

  const updateStock = async (id: string, newStock: number) => {
    if (newStock < 0) return
    setStocks(prev => ({ ...prev, [id]: newStock }))
    setSaving(id)
    await updateBanoStock(id, newStock)
    setSaving(null)
  }

  const adjustBodega = async (productId: string, bodega: string, newStock: number) => {
    if (newStock < 0) return
    const savingKey = `${productId}:${bodega}`
    setBodegaMap(prev => ({
      ...prev,
      [productId]: (prev[productId] || []).map(r => (r.bodega === bodega ? { ...r, stock: newStock } : r)),
    }))
    setSaving(savingKey)
    const res = await adjustProductBodegaStock(productId, bodega, newStock)
    if (res.total !== undefined) setStocks(prev => ({ ...prev, [productId]: res.total! }))
    setSaving(null)
  }

  const adjustMeshBodega = async (meshId: string, bodega: string, newStock: number) => {
    if (newStock < 0) return
    const savingKey = `mesh:${meshId}:${bodega}`
    setMeshBodegaMap(prev => ({
      ...prev,
      [meshId]: (prev[meshId] || []).map(r => (r.bodega === bodega ? { ...r, stock: newStock } : r)),
    }))
    setSaving(savingKey)
    const res = await adjustMeshBodegaStock(meshId, bodega, newStock)
    if (res.total !== undefined) setStocks(prev => ({ ...prev, [meshId]: res.total! }))
    setSaving(null)
  }

  const adjustAccessoryBodega = async (accessoryId: string, bodega: string, newStock: number) => {
    if (newStock < 0) return
    const savingKey = `acc:${accessoryId}:${bodega}`
    setAccessoryBodegaMap(prev => ({
      ...prev,
      [accessoryId]: (prev[accessoryId] || []).map(r => (r.bodega === bodega ? { ...r, stock: newStock } : r)),
    }))
    setSaving(savingKey)
    const res = await adjustAccessoryBodegaStock(accessoryId, bodega, newStock)
    if (res.total !== undefined) setStocks(prev => ({ ...prev, [accessoryId]: res.total! }))
    setSaving(null)
  }

  const badgeForStock = (stock: number) => {
    const s = getStockStatus(stock)
    return s === 'available' ? 'badge-success' : s === 'low' ? 'badge-warning' : 'badge-danger'
  }

  const exportToExcel = async () => {
    setExporting(true)
    try {
      const { buildInventoryWorkbook, downloadWorkbook } = await import('@/lib/excelExport')

      let scoped = products
      let scopedMeshes = meshes
      if (exportScope === 'brand' && selectedBrandId) {
        scoped = products.filter(p => p.brand_id === selectedBrandId)
        scopedMeshes = meshes.filter(m => m.brand_id === selectedBrandId)
      } else if (exportScope === 'size' && selectedSizeId) {
        scoped = products.filter(p => p.size_id === selectedSizeId)
        scopedMeshes = meshes.filter(m => m.size_id === selectedSizeId)
      }

      type Item = { name: string; formato: string; area: number; piezas: number | null; m2: number | null; stock: number; precio: number | null; brand: string }
      let items: Item[] = []

      type MeshItem = { name: string; brand: string; formato: string; piezas: number | null; m2: number | null; precio: number | null; bodega: string; stock: number }
      let meshItems: MeshItem[] = []

      if (exportScope === 'bodega' && selectedBodega) {
        scoped.forEach(p => {
          const row = (bodegaMap[p.id] || []).find(b => b.bodega === selectedBodega)
          if (!row) return
          items.push({
            name: p.name,
            formato: p.size?.label || 'Sin medida',
            area: p.size ? p.size.width * p.size.height : 0,
            piezas: p.sale_unit === 'pieza' ? null : p.pieces_per_box,
            m2: p.sqm_per_box,
            stock: row.stock,
            precio: p.price_per_sqm,
            brand: p.brand?.name || 'Sin marca',
          })
        })
        scopedMeshes.forEach(m => {
          const row = (meshBodegaMap[m.id] || []).find(b => b.bodega === selectedBodega)
          if (!row) return
          meshItems.push({
            name: m.name,
            brand: m.brand?.name || 'Sin marca',
            formato: m.size?.label || 'Sin medida',
            piezas: m.sale_unit === 'pieza' ? null : m.pieces_per_box,
            m2: m.sqm_per_box,
            precio: m.price_per_sqm,
            bodega: selectedBodega,
            stock: row.stock,
          })
        })
      } else {
        items = scoped.map(p => ({
          name: p.name,
          formato: p.size?.label || 'Sin medida',
          area: p.size ? p.size.width * p.size.height : 0,
          piezas: p.sale_unit === 'pieza' ? null : p.pieces_per_box,
          m2: p.sqm_per_box,
          stock: stocks[p.id],
          precio: p.price_per_sqm,
          brand: p.brand?.name || 'Sin marca',
        }))
        meshItems = scopedMeshes.map(m => ({
          name: m.name,
          brand: m.brand?.name || 'Sin marca',
          formato: m.size?.label || 'Sin medida',
          piezas: m.sale_unit === 'pieza' ? null : m.pieces_per_box,
          m2: m.sqm_per_box,
          precio: m.price_per_sqm,
          bodega: (meshBodegaMap[m.id] || []).map(r => r.bodega).join(', '),
          stock: stocks[m.id],
        }))
      }

      const scopedBanos = exportScope === 'bodega' && selectedBodega
        ? banos.filter(b => (b.bodegas || []).includes(selectedBodega))
        : banos
      const scopedAccessories = exportScope === 'bodega' && selectedBodega
        ? accessories.filter(a => (accessoryBodegaMap[a.id] || []).some(r => r.bodega === selectedBodega))
        : accessories

      const workbook = await buildInventoryWorkbook({
        items,
        meshes: meshItems,
        banos: scopedBanos.map(b => ({ name: b.name, brand: b.brand, model: b.model, color: b.color, bodega: fmtBodegas(b.bodegas), stock: stocks[b.id], price: b.price })),
        accessories: scopedAccessories.map(a => {
          const rows = accessoryBodegaMap[a.id] || []
          if (exportScope === 'bodega' && selectedBodega) {
            const row = rows.find(r => r.bodega === selectedBodega)
            return { name: a.name, category: a.category, bodega: selectedBodega, stock: row?.stock ?? 0 }
          }
          return { name: a.name, category: a.category, bodega: rows.map(r => r.bodega).join(', '), stock: stocks[a.id] }
        }),
      })

      let filename = 'inventario_general.xlsx'
      if (exportScope === 'brand' && selectedBrandId) filename = `inventario_${(brands.find(b => b.id === selectedBrandId)?.name || 'marca').replace(/\s+/g, '_')}.xlsx`
      else if (exportScope === 'size' && selectedSizeId) filename = `inventario_${(sizes.find(s => s.id === selectedSizeId)?.label || 'medida').replace(/\s+/g, '_')}.xlsx`
      else if (exportScope === 'bodega' && selectedBodega) filename = `inventario_${selectedBodega.replace(/\s+/g, '_')}.xlsx`

      await downloadWorkbook(workbook, filename)
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
          onChange={e => { setExportScope(e.target.value as ExportScope); setSelectedBrandId(''); setSelectedSizeId(''); setSelectedBodega('') }}
        >
          <option value="all">Todo el inventario</option>
          <option value="brand">Por marca</option>
          <option value="size">Por medida</option>
          <option value="bodega">Por bodega</option>
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
        {exportScope === 'bodega' && (
          <select
            className="form-select"
            style={{ fontSize: '13px', padding: '6px 10px', width: 'auto' }}
            value={selectedBodega}
            onChange={e => setSelectedBodega(e.target.value)}
          >
            <option value="">Seleccionar bodega...</option>
            {WAREHOUSES.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        )}
        <button
          className="btn btn-secondary"
          style={{ fontSize: '13px', padding: '6px 14px' }}
          onClick={exportToExcel}
          disabled={
            exporting ||
            (exportScope === 'brand' && !selectedBrandId) ||
            (exportScope === 'size' && !selectedSizeId) ||
            (exportScope === 'bodega' && !selectedBodega)
          }
        >
          {exporting ? <><Loader2 size={14} className="spin" /> Generando...</> : <><FileSpreadsheet size={14} /> Descargar Excel</>}
        </button>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'pisos' ? 'active' : ''}`} onClick={() => setTab('pisos')}><Layers size={15} /> Pisos ({products.length})</button>
        <button className={`tab ${tab === 'mallas' ? 'active' : ''}`} onClick={() => setTab('mallas')}><Grid3x3 size={15} /> Mallas ({meshes.length})</button>
        <button className={`tab ${tab === 'banos' ? 'active' : ''}`} onClick={() => setTab('banos')}><Toilet size={15} /> Baños ({banos.length})</button>
        <button className={`tab ${tab === 'accesorios' ? 'active' : ''}`} onClick={() => setTab('accesorios')}><Package size={15} /> Adhesivos ({accessories.length})</button>
      </div>

      {tab === 'pisos' && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Filtrar:</span>
          <select
            className="form-select"
            style={{ fontSize: '13px', padding: '6px 10px', width: 'auto' }}
            value={filterBrandId}
            onChange={e => setFilterBrandId(e.target.value)}
          >
            <option value="">Todas las marcas</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select
            className="form-select"
            style={{ fontSize: '13px', padding: '6px 10px', width: 'auto' }}
            value={filterSizeId}
            onChange={e => setFilterSizeId(e.target.value)}
          >
            <option value="">Todas las medidas</option>
            {sizes.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {(filterBrandId || filterSizeId) && (
            <button className="btn btn-ghost" style={{ fontSize: '13px', padding: '6px 12px' }} onClick={() => { setFilterBrandId(''); setFilterSizeId('') }}>
              Limpiar filtro
            </button>
          )}
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{filteredProducts.length} producto(s)</span>
        </div>
      )}

      {tab === 'mallas' && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Filtrar:</span>
          <select
            className="form-select"
            style={{ fontSize: '13px', padding: '6px 10px', width: 'auto' }}
            value={filterBrandIdMesh}
            onChange={e => setFilterBrandIdMesh(e.target.value)}
          >
            <option value="">Todas las marcas</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select
            className="form-select"
            style={{ fontSize: '13px', padding: '6px 10px', width: 'auto' }}
            value={filterSizeIdMesh}
            onChange={e => setFilterSizeIdMesh(e.target.value)}
          >
            <option value="">Todas las medidas</option>
            {sizes.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {(filterBrandIdMesh || filterSizeIdMesh) && (
            <button className="btn btn-ghost" style={{ fontSize: '13px', padding: '6px 12px' }} onClick={() => { setFilterBrandIdMesh(''); setFilterSizeIdMesh('') }}>
              Limpiar filtro
            </button>
          )}
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{filteredMeshes.length} malla(s)</span>
        </div>
      )}

      {tab === 'pisos' && selectedIds.size > 0 && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px', padding: '12px 16px', background: 'var(--primary-light)', borderRadius: 'var(--radius)', border: '1px solid rgba(99,102,241,0.3)' }}>
          <Tag size={16} style={{ color: 'var(--primary-hover)', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{selectedIds.size} seleccionado(s)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            className="form-input"
            placeholder="Nuevo precio/m²"
            style={{ width: '160px', padding: '6px 10px', fontSize: '13px' }}
            value={bulkPrice}
            onChange={e => setBulkPrice(e.target.value)}
          />
          <button
            className="btn btn-primary"
            style={{ fontSize: '13px', padding: '6px 14px' }}
            onClick={applyBulkPrice}
            disabled={applyingBulk || !bulkPrice || parseFloat(bulkPrice) <= 0}
          >
            {applyingBulk ? <><Loader2 size={14} className="spin" /> Aplicando...</> : 'Aplicar precio'}
          </button>
          <button className="btn btn-ghost" style={{ fontSize: '13px', padding: '6px 14px' }} onClick={() => setSelectedIds(new Set())}>
            Cancelar selección
          </button>
        </div>
      )}

      {tab === 'mallas' && selectedMeshIds.size > 0 && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px', padding: '12px 16px', background: 'var(--primary-light)', borderRadius: 'var(--radius)', border: '1px solid rgba(99,102,241,0.3)' }}>
          <Tag size={16} style={{ color: 'var(--primary-hover)', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{selectedMeshIds.size} seleccionada(s)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            className="form-input"
            placeholder="Nuevo precio/m²"
            style={{ width: '160px', padding: '6px 10px', fontSize: '13px' }}
            value={bulkPriceMesh}
            onChange={e => setBulkPriceMesh(e.target.value)}
          />
          <button
            className="btn btn-primary"
            style={{ fontSize: '13px', padding: '6px 14px' }}
            onClick={applyBulkPriceMesh}
            disabled={applyingBulkMesh || !bulkPriceMesh || parseFloat(bulkPriceMesh) <= 0}
          >
            {applyingBulkMesh ? <><Loader2 size={14} className="spin" /> Aplicando...</> : 'Aplicar precio'}
          </button>
          <button className="btn btn-ghost" style={{ fontSize: '13px', padding: '6px 14px' }} onClick={() => setSelectedMeshIds(new Set())}>
            Cancelar selección
          </button>
        </div>
      )}

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              {tab === 'pisos' && (
                <th style={{ width: '32px' }}>
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllPisos}
                  />
                </th>
              )}
              {tab === 'mallas' && (
                <th style={{ width: '32px' }}>
                  <input
                    type="checkbox"
                    checked={allFilteredMeshesSelected}
                    onChange={toggleSelectAllMallas}
                  />
                </th>
              )}
              <th>Producto</th>
              {(tab === 'pisos' || tab === 'mallas') && <><th>Marca</th><th>Medida</th><th>Precio/m²</th></>}
              {tab === 'banos' && <><th>Marca</th><th>Modelo</th></>}
              {tab === 'accesorios' && <th>Categoría</th>}
              <th>Bodega</th>
              <th>Estado</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {tab === 'pisos' && filteredProducts.map(p => {
              const price = priceOverrides[p.id] ?? p.price_per_sqm
              const rows = bodegaMap[p.id] || []
              const isExpanded = expanded.has(p.id)
              return (
                <Fragment key={p.id}>
                  <tr>
                    <td>
                      <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelected(p.id)} />
                    </td>
                    <td style={{ color: 'var(--text)', fontWeight: 500 }}>
                      <button
                        onClick={() => toggleExpanded(p.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'inherit', font: 'inherit', padding: 0 }}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {p.name}
                      </button>
                    </td>
                    <td>{p.brand?.name || '—'}</td>
                    <td>{p.size?.label || '—'}</td>
                    <td style={{ fontSize: '13px' }}>
                      {price
                        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price)
                        : '—'}
                    </td>
                    <td style={{ fontSize: '13px' }}>{rows.map(r => r.bodega).join(', ') || '—'}</td>
                    <td><span className={`badge ${badgeForStock(stocks[p.id])}`}>{stocks[p.id]} {p.sale_unit === 'pieza' ? 'piezas' : 'cajas'}</span></td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{stocks[p.id]}</td>
                  </tr>
                  {isExpanded && (
                    rows.length > 0 ? rows.map(r => (
                      <tr key={`${p.id}-${r.bodega}`} style={{ background: 'var(--bg)' }}>
                        <td></td>
                        <td style={{ paddingLeft: '32px', fontSize: '13px', color: 'var(--text-secondary)' }}>↳ {r.bodega}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td>
                          <div className="stock-control">
                            <button className="stock-btn" onClick={() => adjustBodega(p.id, r.bodega, r.stock - 1)} disabled={saving === `${p.id}:${r.bodega}` || r.stock <= 0}>−</button>
                            <span className="stock-value" style={{ opacity: saving === `${p.id}:${r.bodega}` ? 0.5 : 1 }}>{r.stock}</span>
                            <button className="stock-btn" onClick={() => adjustBodega(p.id, r.bodega, r.stock + 1)} disabled={saving === `${p.id}:${r.bodega}`}>+</button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr style={{ background: 'var(--bg)' }}>
                        <td></td>
                        <td colSpan={7} style={{ paddingLeft: '32px', fontSize: '13px', color: 'var(--text-muted)' }}>
                          Sin bodega asignada — edítalo desde &quot;Editar Piso&quot;
                        </td>
                      </tr>
                    )
                  )}
                </Fragment>
              )
            })}
            {tab === 'mallas' && filteredMeshes.map(m => {
              const price = priceOverrides[m.id] ?? m.price_per_sqm
              const rows = meshBodegaMap[m.id] || []
              const isExpanded = expanded.has(m.id)
              return (
                <Fragment key={m.id}>
                  <tr>
                    <td>
                      <input type="checkbox" checked={selectedMeshIds.has(m.id)} onChange={() => toggleSelectedMesh(m.id)} />
                    </td>
                    <td style={{ color: 'var(--text)', fontWeight: 500 }}>
                      <button
                        onClick={() => toggleExpanded(m.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'inherit', font: 'inherit', padding: 0 }}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {m.name}
                      </button>
                    </td>
                    <td>{m.brand?.name || '—'}</td>
                    <td>{m.size?.label || '—'}</td>
                    <td style={{ fontSize: '13px' }}>
                      {price
                        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price)
                        : '—'}
                    </td>
                    <td style={{ fontSize: '13px' }}>{rows.map(r => r.bodega).join(', ') || '—'}</td>
                    <td><span className={`badge ${badgeForStock(stocks[m.id])}`}>{stocks[m.id]} {m.sale_unit === 'pieza' ? 'piezas' : 'cajas'}</span></td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{stocks[m.id]}</td>
                  </tr>
                  {isExpanded && (
                    rows.length > 0 ? rows.map(r => (
                      <tr key={`${m.id}-${r.bodega}`} style={{ background: 'var(--bg)' }}>
                        <td></td>
                        <td style={{ paddingLeft: '32px', fontSize: '13px', color: 'var(--text-secondary)' }}>↳ {r.bodega}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td>
                          <div className="stock-control">
                            <button className="stock-btn" onClick={() => adjustMeshBodega(m.id, r.bodega, r.stock - 1)} disabled={saving === `mesh:${m.id}:${r.bodega}` || r.stock <= 0}>−</button>
                            <span className="stock-value" style={{ opacity: saving === `mesh:${m.id}:${r.bodega}` ? 0.5 : 1 }}>{r.stock}</span>
                            <button className="stock-btn" onClick={() => adjustMeshBodega(m.id, r.bodega, r.stock + 1)} disabled={saving === `mesh:${m.id}:${r.bodega}`}>+</button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr style={{ background: 'var(--bg)' }}>
                        <td></td>
                        <td colSpan={7} style={{ paddingLeft: '32px', fontSize: '13px', color: 'var(--text-muted)' }}>
                          Sin bodega asignada — edítala desde &quot;Editar Malla&quot;
                        </td>
                      </tr>
                    )
                  )}
                </Fragment>
              )
            })}
            {tab === 'banos' && banos.map(b => (
              <tr key={b.id}>
                <td style={{ color: 'var(--text)', fontWeight: 500 }}>{b.name}</td>
                <td>{b.brand || '—'}</td>
                <td>{b.model || '—'}</td>
                <td style={{ fontSize: '13px' }}>{fmtBodegas(b.bodegas) || '—'}</td>
                <td><span className={`badge ${badgeForStock(stocks[b.id])}`}>{stocks[b.id]} piezas</span></td>
                <td>
                  <div className="stock-control">
                    <button className="stock-btn" onClick={() => updateStock(b.id, stocks[b.id] - 1)} disabled={saving === b.id}>−</button>
                    <span className="stock-value" style={{ opacity: saving === b.id ? 0.5 : 1 }}>{stocks[b.id]}</span>
                    <button className="stock-btn" onClick={() => updateStock(b.id, stocks[b.id] + 1)} disabled={saving === b.id}>+</button>
                  </div>
                </td>
              </tr>
            ))}
            {tab === 'accesorios' && accessories.map(a => {
              const rows = accessoryBodegaMap[a.id] || []
              const isExpanded = expanded.has(a.id)
              return (
                <Fragment key={a.id}>
                  <tr>
                    <td style={{ color: 'var(--text)', fontWeight: 500 }}>
                      <button
                        onClick={() => toggleExpanded(a.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'inherit', font: 'inherit', padding: 0 }}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {a.name}
                      </button>
                    </td>
                    <td><span className="badge badge-accent">{a.category === 'adhesivo' ? 'Adhesivo' : 'Boquilla'}</span></td>
                    <td style={{ fontSize: '13px' }}>{rows.map(r => r.bodega).join(', ') || '—'}</td>
                    <td><span className={`badge ${badgeForStock(stocks[a.id])}`}>{stocks[a.id]} unidades</span></td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{stocks[a.id]}</td>
                  </tr>
                  {isExpanded && (
                    rows.length > 0 ? rows.map(r => (
                      <tr key={`${a.id}-${r.bodega}`} style={{ background: 'var(--bg)' }}>
                        <td style={{ paddingLeft: '32px', fontSize: '13px', color: 'var(--text-secondary)' }}>↳ {r.bodega}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td>
                          <div className="stock-control">
                            <button className="stock-btn" onClick={() => adjustAccessoryBodega(a.id, r.bodega, r.stock - 1)} disabled={saving === `acc:${a.id}:${r.bodega}` || r.stock <= 0}>−</button>
                            <span className="stock-value" style={{ opacity: saving === `acc:${a.id}:${r.bodega}` ? 0.5 : 1 }}>{r.stock}</span>
                            <button className="stock-btn" onClick={() => adjustAccessoryBodega(a.id, r.bodega, r.stock + 1)} disabled={saving === `acc:${a.id}:${r.bodega}`}>+</button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr style={{ background: 'var(--bg)' }}>
                        <td></td>
                        <td colSpan={4} style={{ paddingLeft: '32px', fontSize: '13px', color: 'var(--text-muted)' }}>
                          Sin bodega asignada — edítalo desde &quot;Editar&quot;
                        </td>
                      </tr>
                    )
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {feedback && (
        <div className="toast-container">
          <div className={`toast ${feedback.type === 'success' ? 'toast-success' : 'toast-error'}`}>
            {feedback.message}
          </div>
        </div>
      )}
    </>
  )
}
