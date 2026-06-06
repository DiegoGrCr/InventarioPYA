'use client'

import { useEffect, useState } from 'react'
import { Download, X, Share } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwa-install-dismissed'
const DISMISS_DAYS = 7

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Ya instalada como PWA — no mostrar
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if ((window.navigator as { standalone?: boolean }).standalone) return

    // Descartada recientemente
    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed && Date.now() - parseInt(dismissed) < DISMISS_DAYS * 86400000) return

    const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())
    setIsIOS(ios)

    if (ios) {
      // En iOS no hay beforeinstallprompt, mostramos instrucciones manuales
      setTimeout(() => setShow(true), 3000)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(var(--mobile-nav-height, 65px) + 12px)',
      left: '12px',
      right: '12px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--primary)',
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: 400,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      animation: 'slideUp 300ms ease',
    }}>
      <img
        src="/icons/icon-72x72.png"
        alt="Icono"
        style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: 2 }}>
          Instalar PYA Jalpan
        </p>
        {isIOS ? (
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Toca <Share size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> <strong>Compartir</strong> y luego <strong>"Agregar a inicio"</strong>
          </p>
        ) : (
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Acceso rápido sin abrir el navegador
          </p>
        )}
      </div>

      {!isIOS && (
        <button className="btn btn-primary btn-sm" onClick={handleInstall} style={{ flexShrink: 0 }}>
          <Download size={13} /> Instalar
        </button>
      )}

      <button
        onClick={handleDismiss}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
        aria-label="Cerrar"
      >
        <X size={16} />
      </button>
    </div>
  )
}
