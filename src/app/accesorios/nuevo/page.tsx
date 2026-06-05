'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createAccessory } from '@/actions/accessories'
import { createClient } from '@/lib/supabase/client'
import { Camera, Loader2, CheckCircle } from 'lucide-react'

export default function NuevoAccesorioPage() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [category, setCategory] = useState('adhesivo')

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)

    setUploading(true)
    setUploadError('')
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const folder = category === 'adhesivo' ? 'adhesivos' : 'boquillas'
      const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: storageError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: false })

      if (storageError) {
        setUploadError(`No se pudo subir la imagen: ${storageError.message}`)
        setPreview(null)
        setImageUrl(null)
      } else {
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName)
        setImageUrl(urlData.publicUrl)
      }
    } catch {
      setUploadError('Error al conectar con el servidor de imágenes')
      setPreview(null)
      setImageUrl(null)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (uploading) return
    setLoading(true)
    setError('')
    const formData = new FormData(formRef.current!)
    const result = await createAccessory(formData)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push('/accesorios')
      router.refresh()
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-ghost btn-icon" onClick={() => router.back()}>←</button>
          <div>
            <h1>Nuevo Accesorio</h1>
            <p>Agrega un adhesivo o boquilla</p>
          </div>
        </div>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="form-card">
        <input type="hidden" name="image_url" value={imageUrl || ''} />
        {error && <div style={{ padding: '12px', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', marginBottom: '20px', fontSize: '14px' }}>{error}</div>}

        <div className="form-group">
          <label className="form-label">Foto</label>
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
              {!uploading && <button type="button" className="image-preview-remove" onClick={() => { setPreview(null); setImageUrl(null) }}>✕</button>}
            </div>
          ) : (
            <label className="image-upload" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
              <div className="image-upload-icon">{uploading ? <Loader2 size={32} className="spin" /> : <Camera size={32} />}</div>
              <p>{uploading ? 'Subiendo imagen...' : 'Click para subir imagen'}</p>
              <input type="file" name="image_file" accept="image/*" onChange={handleImageChange} disabled={uploading} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Nombre *</label>
          <input type="text" name="name" className="form-input" required placeholder="Ej: Pegapiso Blanco 20kg" />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Categoría *</label>
            <select name="category" className="form-select" required value={category} onChange={e => setCategory(e.target.value)}>
              <option value="adhesivo">Adhesivo</option>
              <option value="boquilla">Boquilla</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Marca</label>
            <input type="text" name="brand" className="form-input" placeholder="Marca del producto" />
          </div>
        </div>

        <div className="form-row-3">
          <div className="form-group">
            <label className="form-label">Peso</label>
            <input type="text" name="weight" className="form-input" placeholder="20kg" />
          </div>
          <div className="form-group">
            <label className="form-label">Color</label>
            <input type="text" name="color" className="form-input" placeholder="Blanco" />
          </div>
          <div className="form-group">
            <label className="form-label">Stock</label>
            <input type="number" name="stock" className="form-input" min="0" defaultValue={0} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Precio (MXN)</label>
          <input type="number" name="price" className="form-input" min="0" step="0.01" placeholder="0.00" />
        </div>

        <div className="form-group">
          <label className="form-label">Descripción</label>
          <textarea name="description" className="form-textarea" placeholder="Descripción del producto..." />
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button type="submit" className="btn btn-primary" disabled={loading || uploading}>
            {loading ? <><Loader2 size={15} className="spin" /> Guardando...</> : uploading ? <><Loader2 size={15} className="spin" /> Subiendo imagen...</> : <><CheckCircle size={15} /> Crear Accesorio</>}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}
