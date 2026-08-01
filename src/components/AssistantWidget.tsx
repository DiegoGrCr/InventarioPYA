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
                {m.contactos && m.contactos.length > 0 && (
                  <div className="assistant-contacts">
                    {m.contactos.map(c => (
                      <a
                        key={c.bodega}
                        href={`https://wa.me/52${c.whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="assistant-contact-btn"
                      >
                        <span className="assistant-contact-dot">●</span>
                        Contactar {c.sucursal} por WhatsApp
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
