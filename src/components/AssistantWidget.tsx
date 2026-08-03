'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bot, X, Send, Loader2, Layers } from 'lucide-react'

const GREETING_STORAGE_KEY = 'assistant_greeting_date'
const GREETINGS = [
  '¡Hola! 👋 ¿Buscas ideas para tus pisos o baños? Aquí estoy para ayudarte.',
  '¿Tienes dudas sobre algún piso, azulejo o baño? Pregúntame lo que sea.',
  '¡Hola! Si necesitas ayuda para elegir un piso o azulejo, con gusto te oriento.',
]

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.372-.01-.571-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zm-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.511-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898 1.865 1.867 2.893 4.35 2.892 6.99-.003 5.45-4.437 9.888-9.883 9.888m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
    </svg>
  )
}

interface ProductoEncontrado {
  id: string
  nombre: string
  imagen_url: string | null
  precio_por_m2: number | null
  en_existencia: boolean
}

interface ContactoSucursal {
  bodega: string
  sucursal: string
  whatsapp: string
  ciudad: string
}

interface Msg {
  role: 'user' | 'assistant'
  text: string
  productos?: ProductoEncontrado[]
  contactos?: ContactoSucursal[]
  catalogoUrl?: string
}

const WELCOME: Msg = {
  role: 'assistant',
  text: '¡Hola! 👋 Soy tu asistente de diseño (versión de prueba). Pregúntame sobre pisos, azulejos, baños o cómo combinar tu espacio.',
}

export default function AssistantWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [greeting, setGreeting] = useState<string | null>(null)
  const [greetingLeaving, setGreetingLeaving] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  // Saluda de forma proactiva como máximo una vez por día por visitante, para
  // que la gente note que el asistente existe sin sentirse invadida.
  useEffect(() => {
    const today = new Date().toDateString()
    if (localStorage.getItem(GREETING_STORAGE_KEY) === today) return

    const showTimer = setTimeout(() => {
      setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)])
      localStorage.setItem(GREETING_STORAGE_KEY, today)
    }, 4000)

    return () => clearTimeout(showTimer)
  }, [])

  const dismissGreeting = () => {
    setGreetingLeaving(true)
    setTimeout(() => { setGreeting(null); setGreetingLeaving(false) }, 220)
  }

  useEffect(() => {
    if (!greeting) return
    const hideTimer = setTimeout(dismissGreeting, 9000)
    return () => clearTimeout(hideTimer)
  }, [greeting])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    const history = messages
    const nextMessages = [...messages, { role: 'user' as const, text }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.reply || data.error || 'Ocurrió un error, intenta de nuevo.',
        productos: data.productos,
        contactos: data.contactos,
        catalogoUrl: data.catalogoUrl,
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'No pude conectarme, intenta de nuevo en un momento.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {greeting && !open && (
        <div
          className={`assistant-greeting${greetingLeaving ? ' assistant-greeting-out' : ''}`}
          onClick={() => { dismissGreeting(); setOpen(true) }}
        >
          {greeting}
          <button
            className="assistant-greeting-close"
            onClick={e => { e.stopPropagation(); dismissGreeting() }}
            aria-label="Cerrar saludo"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <button
        className={`assistant-fab${open ? ' assistant-fab-open' : ''}`}
        onClick={() => { if (greeting) dismissGreeting(); setOpen(o => !o) }}
        aria-label="Asistente de diseño"
      >
        {open ? <X size={22} /> : <Bot size={24} />}
      </button>

      {open && (
        <div className="assistant-panel">
          <div className="assistant-panel-header">
            <Bot size={18} />
            <div>
              <strong>Asistente de diseño</strong>
              <span>Versión de prueba</span>
            </div>
          </div>

          <div className="assistant-messages" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i}>
                <div className={`assistant-msg ${m.role}`}>{m.text}</div>
                {m.productos && m.productos.length > 0 && (
                  <div className="assistant-products">
                    {m.productos.map(p => (
                      <Link key={p.id} href={`/pisos/${p.id}`} className="assistant-product-card">
                        {p.imagen_url
                          ? <img src={p.imagen_url} alt={p.nombre} loading="lazy" />
                          : <div className="assistant-product-noimg"><Layers size={20} strokeWidth={1.5} /></div>}
                        <span className="assistant-product-name">{p.nombre}</span>
                        {p.precio_por_m2 && <span className="assistant-product-price">${p.precio_por_m2}/m²</span>}
                        {!p.en_existencia && <span className="assistant-product-out">Agotado</span>}
                      </Link>
                    ))}
                  </div>
                )}
                {m.catalogoUrl && m.productos && m.productos.length > 0 && (
                  <Link href={m.catalogoUrl} className="assistant-catalog-link">
                    Ver todos en el catálogo →
                  </Link>
                )}
                {m.contactos && m.contactos.length > 0 && (
                  <div className="assistant-contacts">
                    {m.contactos.map(c => (
                      <a
                        key={c.bodega}
                        href={`https://wa.me/52${c.whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="assistant-contact-btn"
                        aria-label={`Contactar a ${c.sucursal} por WhatsApp`}
                      >
                        <WhatsAppIcon />
                        {c.sucursal}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="assistant-msg assistant">
                <Loader2 size={14} className="spin" />
              </div>
            )}
          </div>

          <div className="assistant-input-row">
            <input
              className="form-input"
              placeholder="Pregunta algo sobre diseño..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send() }}
              disabled={loading}
            />
            <button className="btn btn-primary btn-icon" onClick={send} disabled={loading || !input.trim()}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
