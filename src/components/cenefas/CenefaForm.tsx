'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createCenefa, updateCenefa, findCenefasByName } from '@/actions/cenefas'
import { createClient } from '@/lib/supabase/client'
import { Brand, Size, Cenefa, WAREHOUSES } from '@/lib/types'
import { Camera, Loader2, Save, CheckCircle, AlertTriangle } from 'lucide-react'

type NameMatch = { id: string; name: string; brand: { name: string } | null; size: { label: string } | null }

interface CenefaFormProps {
  brands: Brand[]
  sizes: Size[]
  cenefa?: Cenefa
  bodegaStock?: { bodega: string; stock: number }[]
}

export default function CenefaForm({ brands, sizes, cenefa, bodegaStock = [] }: CenefaFormProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(cenefa?.image_url || null)
  const [imageUrl, setImageUrl] = useState<string | null>(cenefa?.image_url || null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [pricePerSqm, setPricePerSqm] = useState(cenefa?.price_per_sqm?.toString() || '')
  const [sqmPerBox, setSqmPerBox] = useState(cenefa?.sqm_per_box?.toString() || '')
  const [piecesPerBox, setPiecesPerBox] = useState(cenefa?.pieces_per_box?.toString() || '')
  const [saleUnit, setSaleUnit] = useState(cenefa?.sale_unit || 'caja')
  const isPieza = saleUnit === 'pieza'

  const initialBodegaMap = Object.fromEntries(bodegaStock.map(b => [b.bodega, b.stock]))
  const [bodegaEnabled, setBodegaEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(WAREHOUSES.map(w => [w, w in initialBodegaMap]))
  )
  const [bodegaQty, setBodegaQty] = useState<Record<string, string>>(
    Object.fromEntries(WAREHOUSES.map(w => [w, initialBodegaMap[w]?.toString() || '']))
  )
  const totalStock = WAREHOUSES.reduce((sum, w) => sum + (bodegaEnabled[w] ? parseInt(bodegaQty[w]) || 0 : 0), 0)

  const [nameMatches, setNameMatches] = useState<NameMatch[]>([])
  const nameCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleNameChange = (value: string) => {
    if (nameCheckTimeout.current) clearTimeout(nameCheckTimeout.current)
    nameCheckTimeout.current = setTimeout(async () => {
      const matches = await findCenefasByName(value, cenefa?.id)
      setNameMatches(matches as unknown as NameMatch[])
    }, 400)
  }

  const computedPricePerBox = pricePerSqm && sqmPerBox && parseFloat(pricePerSqm) > 0 && parseFloat(sqmPerBox) > 0
    ? (parseFloat(pricePerSqm) * parseFloat(sqmPerBox)).toFixed(2)
    : null

  // Para pieza: precio de la caja completa del proveedor = precio/pieza × piezas/caja
  const computedSupplierBoxPrice = isPieza && computedPricePerBox && piecesPerBox && parseFloat(piecesPerBox) > 0
    ? (parseFloat(computedPricePerBox) * parseFloat(piecesPerBox)).toFixed(2)
    : null

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show local preview immediately
    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)

    // Upload directly from browser to Supabase Storage
    setUploading(true)
    setUploadError('')
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const fileName = `cenefas/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: storageError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: false })

      if (storageError) {
        setUploadError(`No se pudo subir la imagen: ${storageError.message}`)
        setPreview(null)
        setImageUrl(cenefa?.image_url || null)
      } else {
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName)
        setImageUrl(urlData.publicUrl)
      }
    } catch {
      setUploadError('Error al conectar con el servidor de imágenes')
      setPreview(null)
      setImageUrl(cenefa?.image_url || null)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = () => {
    setPreview(null)
    setImageUrl(null)
    setUploadError('')
    const input = formRef.current?.querySelector('input[name=image_file]') as HTMLInputElement
    if (input) input.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (uploading) return
    setLoading(true)
    setError('')

    const formData = new FormData(formRef.current!)
    const result = cenefa
      ? await updateCenefa(cenefa.id, formData)
      : await createCenefa(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push('/cenefas')
      router.refresh()
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="form-card">
      {/* Hidden input carries the Supabase URL to the server action */}
      <input type="hidden" name="image_url" value={imageUrl || ''} />

      {error && <div style={{ padding: '12px', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', marginBottom: '20px', fontSize: '14px' }}>{error}</div>}

      <div className="form-group">
        <label className="form-label">Foto de la cenefa</label>
        {uploadError && (
          <div style={{ padding: '8px 12px', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', marginBottom: '8px', fontSize: '13px' }}>
            {uploadError}
          </div>
        )}
        {preview ? (
          <div className="image-preview">
            <img src={preview} alt="Preview" />
            {uploading && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius)', color: '#fff', fontSize: '14px' }}>
                ⏳ Subiendo...
              </div>
            )}
            {!uploading && <button type="button" className="image-preview-remove" onClick={handleRemoveImage}>✕</button>}
          </div>
        ) : (
          <label className="image-upload" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
            <div className="image-upload-icon">{uploading ? <Loader2 size={32} className="spin" /> : <Camera size={32} />}</div>
            <p>{uploading ? 'Subiendo imagen...' : 'Click para subir imagen'}</p>
            <small>JPG, PNG. Max 5MB</small>
            <input
              type="file"
              name="image_file"
              accept="image/*"
              onChange={handleImageChange}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Nombre de la cenefa *</label>
        <input
          type="text"
          name="name"
          className="form-input"
          required
          defaultValue={cenefa?.name || ''}
          placeholder="Ej: Cenefa Decorativa Gris"
          onChange={e => handleNameChange(e.target.value)}
        />
        {nameMatches.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '8px 12px', background: 'var(--warning-light)', color: 'var(--warning)', borderRadius: 'var(--radius-sm)', marginTop: '8px', fontSize: '13px' }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>
              Ya existe {nameMatches.length === 1 ? 'una cenefa' : `${nameMatches.length} cenefas`} con este nombre: {' '}
              {nameMatches.map((m, i) => (
                <span key={m.id}>
                  {i > 0 && ', '}
                  <strong>{m.name}</strong>
                  {(m.brand || m.size) && ` (${[m.brand?.name, m.size?.label].filter(Boolean).join(' · ')})`}
                </span>
              ))}
              . Puedes continuar si es intencional (ej. otra medida o marca).
            </span>
          </div>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Marca</label>
          <select name="brand_id" className="form-select" defaultValue={cenefa?.brand_id || ''}>
            <option value="">Sin marca</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Medida</label>
          <select name="size_id" className="form-select" defaultValue={cenefa?.size_id || ''}>
            <option value="">Seleccionar...</option>
            {sizes.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row-3">
        <div className="form-group">
          <label className="form-label">SKU</label>
          <input type="text" name="sku" className="form-input" defaultValue={cenefa?.sku || ''} placeholder="Código único" />
        </div>
        <div className="form-group">
          <label className="form-label">Se vende por</label>
          <select name="sale_unit" className="form-select" value={saleUnit} onChange={e => setSaleUnit(e.target.value as 'caja' | 'pieza')}>
            <option value="caja">Caja</option>
            <option value="pieza">Pieza individual</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Color</label>
          <input type="text" name="color" className="form-input" defaultValue={cenefa?.color || ''} placeholder="Gris, Beige..." />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Piezas/caja</label>
          <input
            type="number"
            name="pieces_per_box"
            className="form-input"
            min="1"
            value={piecesPerBox}
            onChange={e => setPiecesPerBox(e.target.value)}
            placeholder="8"
          />
          {isPieza && <small style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', display: 'block' }}>Piezas que trae la caja del proveedor</small>}
        </div>
        <div className="form-group">
          <label className="form-label">{isPieza ? 'm² por pieza' : 'm²/caja'}</label>
          <input
            type="number"
            name="sqm_per_box"
            className="form-input"
            min="0"
            step="0.01"
            value={sqmPerBox}
            onChange={e => setSqmPerBox(e.target.value)}
            placeholder="1.44"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Precio/m² (MXN)</label>
          <input
            type="number"
            name="price_per_sqm"
            className="form-input"
            min="0"
            step="0.01"
            value={pricePerSqm}
            onChange={e => setPricePerSqm(e.target.value)}
            placeholder="250.00"
          />
          {computedPricePerBox && (
            <small style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              = ${computedPricePerBox} {isPieza ? '/pieza' : '/caja'}
            </small>
          )}
          {computedSupplierBoxPrice && (
            <small style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px', display: 'block' }}>
              = ${computedSupplierBoxPrice} /caja ({piecesPerBox} piezas)
            </small>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Acabado</label>
          <input type="text" name="finish" className="form-input" defaultValue={cenefa?.finish || ''} placeholder="Mate, Brillante..." />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Stock por bodega</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {WAREHOUSES.map(w => (
            <div key={w} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label className="checkbox-pill" style={{ minWidth: '180px' }}>
                <input
                  type="checkbox"
                  checked={bodegaEnabled[w]}
                  onChange={e => setBodegaEnabled(prev => ({ ...prev, [w]: e.target.checked }))}
                />
                {w}
              </label>
              {bodegaEnabled[w] && (
                <>
                  <input type="hidden" name="bodega_nombre" value={w} />
                  <input
                    type="number"
                    name="bodega_stock"
                    className="form-input"
                    min="0"
                    style={{ maxWidth: '120px' }}
                    placeholder={isPieza ? 'Piezas' : 'Cajas'}
                    value={bodegaQty[w]}
                    onChange={e => setBodegaQty(prev => ({ ...prev, [w]: e.target.value }))}
                  />
                </>
              )}
            </div>
          ))}
        </div>
        <div className="form-hint" style={{ marginTop: '8px' }}>
          Stock total: <strong style={{ color: 'var(--text)' }}>{totalStock} {isPieza ? 'piezas' : 'cajas'}</strong>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Descripción</label>
        <textarea name="description" className="form-textarea" defaultValue={cenefa?.description || ''} placeholder="Características de la cenefa..." />
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <button type="submit" className="btn btn-primary" disabled={loading || uploading}>
          {loading ? <><Loader2 size={15} className="spin" /> Guardando...</> : uploading ? <><Loader2 size={15} className="spin" /> Subiendo imagen...</> : cenefa ? <><Save size={15} /> Actualizar</> : <><CheckCircle size={15} /> Crear Cenefa</>}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancelar</button>
      </div>
    </form>
  )
}
