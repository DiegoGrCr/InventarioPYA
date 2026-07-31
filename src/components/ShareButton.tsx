'use client'

import { useEffect, useRef, useState } from 'react'
import { Share2, Copy, Check } from 'lucide-react'

export default function ShareButton({ title }: { title: string }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleShare = async () => {
    const url = window.location.href
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url })
      } catch {
        // el usuario canceló el share, no hacer nada
      }
      return
    }
    setMenuOpen(prev => !prev)
  }

  const shareWhatsApp = () => {
    const url = window.location.href
    const text = encodeURIComponent(`${title} - ${url}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
    setMenuOpen(false)
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    setMenuOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button className="btn btn-secondary" onClick={handleShare}>
        <Share2 size={15} /> Compartir
      </button>
      {menuOpen && (
        <div className="share-menu">
          <button className="share-menu-item" onClick={shareWhatsApp}>
            <span style={{ color: '#25D366' }}>●</span> WhatsApp
          </button>
          <button className="share-menu-item" onClick={copyLink}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar enlace'}
          </button>
        </div>
      )}
    </div>
  )
}
