'use client'

import { useEffect, useState } from 'react'
import { Download, X, Share } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwa-install-dismissed'
const DISMISS_DAYS = 7
// Cuánto esperar antes de volver a mostrarlo si no se descartó explícito
// (ej. se autocerró a los 10s, o el navegador disparó beforeinstallprompt
// de nuevo) — sin esto podía reaparecer en cada cambio de sección.
const LAST_SHOWN_KEY = 'pwa-install-last-shown'
const COOLDOWN_MS = 30 * 60 * 1000

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [closing, setClosing] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  const dismiss = (permanent: boolean) => {
    setClosing(true)
    setTimeout(() => {
      setShow(false)
      setClosing(false)
      if (permanent) localStorage.setItem(DISMISS_KEY, Date.now().toString())
    }, 250)
  }

  const showPrompt = () => {
    localStorage.setItem(LAST_SHOWN_KEY, Date.now().toString())
    setShow(true)
  }

  // Se cierra solo a los 10s si nadie interactúa con él
  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => dismiss(false), 10000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show])

  useEffect(() => {
    // Ya instalada como PWA — no mostrar
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if ((window.navigator as { standalone?: boolean }).standalone) return

    // Descartada explícitamente hace poco
    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed && Date.now() - parseInt(dismissed) < DISMISS_DAYS * 86400000) return

    // Ya se mostró hace poco (se haya cerrado como sea) — evita que reaparezca
    // en cada cambio de sección si algo dispara beforeinstallprompt de nuevo.
    const lastShown = localStorage.getItem(LAST_SHOWN_KEY)
    if (lastShown && Date.now() - parseInt(lastShown) < COOLDOWN_MS) return

    const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())
    setIsIOS(ios)

    if (ios) {
      // En iOS no hay beforeinstallprompt, mostramos instrucciones manuales
      setTimeout(() => showPrompt(), 3000)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      showPrompt()
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') dismiss(true)
    setDeferredPrompt(null)
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(var(--mobile-nav-height, 65px) + 12px)',
      right: '12px',
      maxWidth: '300px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      zIndex: 400,
      boxShadow: 'var(--shadow)',
      animation: closing ? 'installPromptOut 250ms ease forwards' : 'slideUp 300ms ease',
    }}>
      <img
        src="/icons/icon-72x72.png"
        alt="Icono"
        style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0 }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: '13px', marginBottom: 1 }}>
          Instalar PYA Jalpan
        </p>
        {isIOS ? (
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Toca <Share size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> <strong>Compartir</strong> y <strong>"Agregar a inicio"</strong>
          </p>
        ) : (
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Acceso rápido sin el navegador
          </p>
        )}
      </div>

      {!isIOS && (
        <button className="btn btn-primary btn-sm" onClick={handleInstall} style={{ flexShrink: 0, padding: '5px 10px', fontSize: '12px' }}>
          <Download size={12} /> Instalar
        </button>
      )}

      <button
        onClick={() => dismiss(true)}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
        aria-label="Cerrar"
      >
        <X size={15} />
      </button>
    </div>
  )
}
