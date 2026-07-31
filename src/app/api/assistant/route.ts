import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `Eres el asistente virtual de "Pisos y Azulejos de Jalpan", una tienda de pisos, azulejos y baños.

Esta es una VERSIÓN DE PRUEBA: no tienes acceso al catálogo, precios ni existencias reales de la tienda.
Si te preguntan por precio, disponibilidad o stock de un producto específico, indica amablemente que no
tienes esa información en este momento y sugiere revisar el catálogo en la página o contactar directamente
a la tienda. Nunca inventes precios, medidas de productos específicos ni existencias.

Tu tema son ÚNICAMENTE: diseño de interiores, decoración, y todo lo relacionado a pisos, azulejos y baños
(tipos de material, combinación de colores, tendencias, cómo elegir medida/acabado según el espacio, tips
de instalación y mantenimiento). Si te preguntan algo fuera de ese tema, redirige amablemente la
conversación de vuelta a diseño de interiores/pisos.

Responde siempre en español, de forma breve, cálida y útil: uno o dos párrafos cortos como máximo, sin
usar encabezados ni listas con viñetas (esto se muestra en una burbuja de chat pequeña).`

const MODEL = 'gemini-flash-latest'
const MAX_MESSAGE_LENGTH = 500
const MAX_HISTORY = 6

interface HistoryMsg {
  role: 'user' | 'assistant'
  text: string
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'El asistente no está configurado todavía.' }, { status: 500 })
  }

  let body: { message?: string; history?: HistoryMsg[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const message = body.message?.trim()
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: 'Mensaje inválido' }, { status: 400 })
  }

  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : []

  const contents = [
    ...history.map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.text }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ]

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: {
            maxOutputTokens: 1536,
            temperature: 0.7,
            // El modelo no permite desactivar el "pensamiento" por completo (thinkingBudget: 0
            // devuelve error en este modelo), así que lo dejamos bajo para no comerse el límite
            // de tokens de salida y cortar la respuesta a la mitad.
            thinkingConfig: { thinkingBudget: 128 },
          },
        }),
      }
    )

    const data = await res.json()

    if (data.error) {
      return NextResponse.json({ error: 'El asistente no pudo responder, intenta de nuevo.' }, { status: 502 })
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!reply) {
      return NextResponse.json({ error: 'No pude generar una respuesta, intenta reformular tu pregunta.' }, { status: 502 })
    }

    return NextResponse.json({ reply })
  } catch {
    return NextResponse.json({ error: 'No se pudo conectar con el asistente' }, { status: 500 })
  }
}
