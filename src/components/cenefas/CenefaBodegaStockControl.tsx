'use client'

import { useState } from 'react'
import { adjustCenefaBodegaStock } from '@/actions/cenefas'
import { useIsAdmin } from '@/contexts/AdminContext'

interface CenefaBodegaStockControlProps {
  cenefaId: string
  initialStock: { bodega: string; stock: number }[]
}

export default function CenefaBodegaStockControl({ cenefaId, initialStock }: CenefaBodegaStockControlProps) {
  const [rows, setRows] = useState(initialStock)
  const [saving, setSaving] = useState<string | null>(null)
  const isAdmin = useIsAdmin()

  const adjust = async (bodega: string, newStock: number) => {
    if (newStock < 0) return
    setRows(prev => prev.map(r => (r.bodega === bodega ? { ...r, stock: newStock } : r)))
    setSaving(bodega)
    await adjustCenefaBodegaStock(cenefaId, bodega, newStock)
    setSaving(null)
  }

  if (rows.length === 0) {
    return <span className="stock-value">Sin bodega asignada</span>
  }

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
        {rows.map(r => (
          <span key={r.bodega} className="stock-value" style={{ fontSize: '13px' }}>
            {r.bodega}: {r.stock}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
      {rows.map(r => (
        <div key={r.bodega} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{r.bodega}</span>
          <div className="stock-control">
            <button className="stock-btn" onClick={() => adjust(r.bodega, r.stock - 1)} disabled={saving === r.bodega || r.stock <= 0}>−</button>
            <span className="stock-value" style={{ opacity: saving === r.bodega ? 0.5 : 1 }}>{r.stock}</span>
            <button className="stock-btn" onClick={() => adjust(r.bodega, r.stock + 1)} disabled={saving === r.bodega}>+</button>
          </div>
        </div>
      ))}
    </div>
  )
}
