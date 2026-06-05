'use client'

import { useState } from 'react'
import { createBrand, deleteBrand } from '@/actions/brands'
import { Brand } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { Trash2, Plus } from 'lucide-react'

export default function BrandsManager({ initialBrands }: { initialBrands: Brand[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [isImported, setIsImported] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    if (!name.trim()) return
    setLoading(true)
    await createBrand(name.trim(), isImported)
    setName('')
    setIsImported(false)
    setLoading(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta marca?')) return
    await deleteBrand(id)
    router.refresh()
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label className="form-label">Nueva marca</label>
          <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la marca" onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', padding: '10px 0' }}>
          <input type="checkbox" checked={isImported} onChange={(e) => setIsImported(e.target.checked)} />
          Importado
        </label>
        <button className="btn btn-primary" onClick={handleAdd} disabled={loading}><Plus size={16} /> Agregar</button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Marca</th>
              <th>Tipo</th>
              <th style={{ width: '80px' }}></th>
            </tr>
          </thead>
          <tbody>
            {initialBrands.map((brand) => (
              <tr key={brand.id}>
                <td style={{ color: 'var(--text)', fontWeight: 500 }}>{brand.name}</td>
                <td>
                  <span className={`badge ${brand.is_imported ? 'badge-accent' : 'badge-primary'}`}>
                    {brand.is_imported ? 'Importado' : 'Nacional'}
                  </span>
                </td>
                <td>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(brand.id)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
