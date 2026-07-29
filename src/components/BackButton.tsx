'use client'

import { useRouter } from 'next/navigation'

export default function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter()

  const goBack = () => {
    // Si hay una página anterior en el historial (ej. el catálogo con
    // filtros/página aplicados), regresamos ahí en vez de perder ese estado.
    if (window.history.length > 1) router.back()
    else router.push(fallbackHref)
  }

  return (
    <button type="button" onClick={goBack} className="btn btn-ghost btn-icon" aria-label="Regresar">
      ←
    </button>
  )
}
