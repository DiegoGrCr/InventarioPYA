'use client'

import { useState } from 'react'
import { updateAccessoryStock } from '@/actions/accessories'

interface AccessoryStockControlProps {
  accessoryId: string
  initialStock: number
}

export default function AccessoryStockControl({ accessoryId, initialStock }: AccessoryStockControlProps) {
  const [stock, setStock] = useState(initialStock)
  const [saving, setSaving] = useState(false)

  const updateStock = async (newStock: number) => {
    if (newStock < 0) return
    setStock(newStock)
    setSaving(true)
    await updateAccessoryStock(accessoryId, newStock)
    setSaving(false)
  }

  return (
    <div className="stock-control">
      <button className="stock-btn" onClick={() => updateStock(stock - 1)} disabled={saving || stock <= 0}>−</button>
      <span className="stock-value" style={{ opacity: saving ? 0.5 : 1 }}>{stock}</span>
      <button className="stock-btn" onClick={() => updateStock(stock + 1)} disabled={saving}>+</button>
    </div>
  )
}
