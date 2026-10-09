'use client'

import { useRouter } from 'next/navigation'
import { deleteValvuleria } from '@/actions/valvuleria'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'

export default function DeleteValvuleriaBtn({ valvuleriaId }: { valvuleriaId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)

  const handleDelete = async () => {
    await deleteValvuleria(valvuleriaId)
    router.push('/valvuleria')
    router.refresh()
  }

  if (confirming) {
    return (
      <div style={{ display: 'flex', gap: '4px' }}>
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>Sí, eliminar</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>Cancelar</button>
      </div>
    )
  }

  return (
    <button className="btn btn-danger" onClick={() => setConfirming(true)}>
      <Trash2 size={16} /> Eliminar
    </button>
  )
}
