'use client'

import { useState } from 'react'
import { createSize, deleteSize } from '@/actions/brands'
import { Size } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { Trash2, Plus } from 'lucide-react'

export default function SizesManager({ initialSizes }: { initialSizes: Size[] }) {
  const router = useRouter()
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    const w = parseInt(width)
    const h = parseInt(height)
    if (!w || !h) return
    setLoading(true)
    await createSize(w, h)
    setWidth('')
    setHeight('')
    setLoading(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta medida?')) return
    await deleteSize(id)
    router.refresh()
  }

  return (
    <div style={{ maxWidth: '500px' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label className="form-label">Ancho (cm)</label>
          <input type="number" className="form-input" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="60" min="1" />
        </div>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label className="form-label">Alto (cm)</label>
          <input type="number" className="form-input" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="120" min="1" onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
        </div>
        <button className="btn btn-primary" onClick={handleAdd} disabled={loading}><Plus size={16} /> Agregar</button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Medida</th>
              <th>Ancho</th>
              <th>Alto</th>
              <th style={{ width: '80px' }}></th>
            </tr>
          </thead>
          <tbody>
            {initialSizes.map((size) => (
              <tr key={size.id}>
                <td style={{ color: 'var(--text)', fontWeight: 600 }}>{size.label}</td>
                <td>{size.width} cm</td>
                <td>{size.height} cm</td>
                <td>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(size.id)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
