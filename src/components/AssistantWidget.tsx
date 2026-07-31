'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, X, Send, Loader2 } from 'lucide-react'

interface Msg {
  role: 'user' | 'assistant'
  text: string
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
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

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
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply || data.error || 'Ocurrió un error, intenta de nuevo.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'No pude conectarme, intenta de nuevo en un momento.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        className={`assistant-fab${open ? ' assistant-fab-open' : ''}`}
        onClick={() => setOpen(o => !o)}
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
              <div key={i} className={`assistant-msg ${m.role}`}>{m.text}</div>
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
