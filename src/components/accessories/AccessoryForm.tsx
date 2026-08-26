'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createAccessory, updateAccessory } from '@/actions/accessories'
import { uploadImage } from '@/actions/uploads'
import { Accessory, WAREHOUSES } from '@/lib/types'
import { Camera, Loader2, Save, CheckCircle } from 'lucide-react'

interface AccessoryFormProps {
  accessory?: Accessory
  bodegaStock?: { bodega: string; stock: number }[]
}

export default function AccessoryForm({ accessory, bodegaStock = [] }: AccessoryFormProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(accessory?.image_url || null)
  const [imageUrl, setImageUrl] = useState<string | null>(accessory?.image_url || null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [category, setCategory] = useState(accessory?.category || 'adhesivo')

  const initialBodegaMap = Object.fromEntries(bodegaStock.map(b => [b.bodega, b.stock]))
  const [bodegaEnabled, setBodegaEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(WAREHOUSES.map(w => [w, w in initialBodegaMap]))
  )
  const [bodegaQty, setBodegaQty] = useState<Record<string, string>>(
    Object.fromEntries(WAREHOUSES.map(w => [w, initialBodegaMap[w]?.toString() || '']))
  )
  const totalStock = WAREHOUSES.reduce((sum, w) => sum + (bodegaEnabled[w] ? parseInt(bodegaQty[w]) || 0 : 0), 0)

  const processImageFile = async (file: File) => {
    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)

    setUploading(true)
    setUploadError('')
    try {
      const folder = category === 'adhesivo' ? 'adhesivos' : 'boquillas'
      const result = await uploadImage(file, folder)
      if ('error' in result) {
        setUploadError(result.error)
        setPreview(accessory?.image_url || null)
        setImageUrl(accessory?.image_url || null)
      } else {
        setImageUrl(result.url)
      }
    } catch {
      setUploadError('Error al conectar con el servidor de imágenes')
      setPreview(accessory?.image_url || null)
      setImageUrl(accessory?.image_url || null)
    } finally {
      setUploading(false)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processImageFile(file)
  }

  // Permite pegar una imagen copiada (Ctrl+V) en vez de solo seleccionar un
  // archivo — si el portapapeles no trae una imagen, no hace nada y el pegado
  // normal (ej. en un campo de texto) sigue funcionando igual.
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (uploading) return
      const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (!file) return
      e.preventDefault()
      processImageFile(file)
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploading, category])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (uploading) return
    setLoading(true)
    setError('')
    const formData = new FormData(formRef.current!)
    const result = accessory
      ? await updateAccessory(accessory.id, formData)
      : await createAccessory(formData)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push('/complementos')
      router.refresh()
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="form-card">
      <input type="hidden" name="image_url" value={imageUrl || ''} />
      {error && (
        <div style={{ padding: '12px', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', marginBottom: '20px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Foto</label>
        {uploadError && (
          <div style={{ padding: '8px 12px', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', marginBottom: '8px', fontSize: '13px' }}>
            {uploadError}
          </div>
        )}
        {preview ? (
          <div className="image-preview" style={{ position: 'relative' }}>
            <img src={preview} alt="Preview" />
            {uploading && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius)', color: '#fff', fontSize: '14px' }}>
                <Loader2 size={20} className="spin" style={{ marginRight: 8 }} /> Subiendo...
              </div>
            )}
            {!uploading && (
              <button
                type="button"
                className="image-preview-remove"
                onClick={() => { setPreview(null); setImageUrl(null) }}
              >✕</button>
            )}
          </div>
        ) : (
          <label className="image-upload" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
            <div className="image-upload-icon">
              {uploading ? <Loader2 size={32} className="spin" /> : <Camera size={32} />}
            </div>
            <p>{uploading ? 'Subiendo imagen...' : 'Click para subir, o pega con Ctrl+V'}</p>
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
        <label className="form-label">Nombre *</label>
        <input
          type="text"
          name="name"
          className="form-input"
          required
          defaultValue={accessory?.name || ''}
          placeholder="Ej: Pegapiso Blanco 20kg"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Categoría *</label>
          <select
            name="category"
            className="form-select"
            required
            value={category}
            onChange={e => setCategory(e.target.value as 'adhesivo' | 'boquilla')}
          >
            <option value="adhesivo">Adhesivo</option>
            <option value="boquilla">Boquilla</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Marca</label>
          <input
            type="text"
            name="brand"
            className="form-input"
            defaultValue={accessory?.brand || ''}
            placeholder="Marca del producto"
          />
        </div>
      </div>

      <div className="form-row-3">
        <div className="form-group">
          <label className="form-label">Peso</label>
          <input
            type="text"
            name="weight"
            className="form-input"
            defaultValue={accessory?.weight || ''}
            placeholder="20kg"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Color</label>
          <input
            type="text"
            name="color"
            className="form-input"
            defaultValue={accessory?.color || ''}
            placeholder="Blanco"
          />
        </div>
        <div className="form-group">
          <label className="form-label">SKU</label>
          <input
            type="text"
            name="sku"
            className="form-input"
            defaultValue={accessory?.sku || ''}
            placeholder="Código único"
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Precio (MXN)</label>
        <input
          type="number"
          name="price"
          className="form-input"
          min="0"
          step="0.01"
          defaultValue={accessory?.price ?? ''}
          placeholder="0.00"
        />
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
                    placeholder="Cantidad"
                    value={bodegaQty[w]}
                    onChange={e => setBodegaQty(prev => ({ ...prev, [w]: e.target.value }))}
                  />
                </>
              )}
            </div>
          ))}
        </div>
        <div className="form-hint" style={{ marginTop: '8px' }}>
          Stock total: <strong style={{ color: 'var(--text)' }}>{totalStock} unidades</strong>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Descripción</label>
        <textarea
          name="description"
          className="form-textarea"
          defaultValue={accessory?.description || ''}
          placeholder="Descripción del producto..."
        />
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <button type="submit" className="btn btn-primary" disabled={loading || uploading}>
          {loading
            ? <><Loader2 size={15} className="spin" /> Guardando...</>
            : uploading
              ? <><Loader2 size={15} className="spin" /> Subiendo imagen...</>
              : accessory
                ? <><Save size={15} /> Actualizar</>
                : <><CheckCircle size={15} /> Crear Accesorio</>}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
