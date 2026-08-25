import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { likeSafe } from '@/lib/utils'

const SYSTEM_PROMPT = `Eres el asistente virtual de "Pisos y Azulejos de Jalpan", una tienda de pisos, azulejos y baños.

Tienes acceso a la herramienta "buscar_pisos" para consultar el catálogo REAL de pisos y azulejos de la
tienda (nombre, descripción, material, marca, medida, color, acabado, precio por m² y existencia). Úsala
siempre que te pregunten por disponibilidad, precio, stock o características de un piso o azulejo
específico. Responde ÚNICAMENTE con datos que la herramienta te haya devuelto — nunca inventes precios,
existencias ni productos que no aparezcan en el resultado de la búsqueda. Si la búsqueda no encuentra
nada, dilo con honestidad y sugiere revisar el catálogo completo en la página o contactar a la tienda.

IMPORTANTE sobre "pisos" vs "azulejos": en el catálogo, "Pisos" es una sola categoría de producto que
incluye TANTO piso de suelo COMO azulejo de pared/barra/cubierta — son los mismos productos, solo cambia
el USO según el acabado. Si te piden un azulejo para pared, barra de cocina, cubierta, respaldo o
cualquier superficie que NO sea el suelo, SÍ debes usar "buscar_pisos" normalmente (con cualquier
acabado, brillante/satinado incluidos) — NO respondas que "la herramienta solo cubre pisos" o que
revisen la página, sí tienes esa información. La única restricción real de acabado (solo Mate/
antiderrapante) es para el SUELO de baños/zonas húmedas, ver regla más abajo.

Cada producto que encuentres con la búsqueda se muestra automáticamente en la conversación como una
tarjeta con foto (o ícono si no tiene foto) y un enlace directo a su página — nunca escribas URLs ni
digas cosas como "aquí tienes el link" o "aquí está la imagen", solo habla del producto normalmente,
la tarjeta ya aparece sola debajo de tu respuesta.

Cada producto también trae el desglose de en qué sucursal(es) hay existencia (campo "sucursal", el nombre
comercial — no uses el campo "bodega", que es solo un nombre interno). Menciona el nombre de la sucursal
cuando sea relevante (ej. "lo tenemos en la sucursal Daltile Store"), pero NUNCA escribas tú el número de
WhatsApp ni digas "contáctalos al número..." — el botón de WhatsApp de esa sucursal se muestra
automáticamente en la conversación, solo menciona el nombre de la sucursal.

La herramienta NO cubre muebles/accesorios de baño (WC, lavabos, regaderas) ni adhesivos/boquillas —
esas sí son categorías distintas sin información disponible por ahora, indícalo y sugiere revisar el
catálogo en la página. Pero azulejos/pisos para CUALQUIER superficie (suelo, pared, barra, etc.) sí
están cubiertos, ver la aclaración de arriba.

REGLA DE SEGURIDAD IMPORTANTE — pisos de baño / exteriores / zonas húmedas:
Antes de recomendar un piso para el SUELO de un baño u otra zona húmeda, busca con "texto: antiderrapante"
(junto con el color/medida/marca que pida el cliente). SOLO los productos cuya descripción diga
literalmente "antiderrapante" están confirmados como seguros para el suelo — el acabado "Mate" POR SÍ
SOLO NO es suficiente ni confiable: hay pisos con acabado Mate que son mate solo por estética y NO son
antiderrapantes. Nunca uses "acabado: Mate" como sustituto de buscar "antiderrapante" en texto.
Cada resultado también trae su campo "acabado" real: si ves "Brillante", "Pulido", "Rectificado" o
"Satinado" en un resultado, NO lo recomiendes para el piso — son resbalosos y peligrosos con agua. Esta
restricción es solo para el PISO/suelo — para PAREDES de baño sí es normal y seguro recomendar azulejo
liso o brillante.
Esto aplica también cuando el cliente pide "ver otros" o "más opciones" para el mismo piso de baño: sigue
buscando con "texto: antiderrapante" (puedes relajar color, medida o marca), pero NUNCA quites el
requisito de antiderrapante ni recomiendes un piso solo porque sea Mate.
Ejemplo de error que NO debes repetir: el cliente pide otras opciones de piso de baño y le recomiendas un
piso con acabado Mate que en su descripción NO dice "antiderrapante" — aunque sea Mate, si no está
confirmado como antiderrapante NO se recomienda para el suelo del baño.
Si buscas por color y no encuentras nada con ese color exacto entre los antiderrapantes, prueba también
sin el filtro de color tan estricto (algunos pisos con patrón mezclado, ej. "gris y negro", solo mencionan
el color secundario en la descripción), pero sin quitar "texto: antiderrapante". Si de verdad no
encuentras nada que coincida, dilo con honestidad en vez de recomendar una opción mate "por default".

PRIORIDAD DE MEDIDA para piso de baño: si el cliente no pide una medida específica, busca PRIMERO con
"medida: 20x20" (junto con texto: antiderrapante y el color que haya pedido) — es la medida más común y la
que debes ofrecer de entrada. Solo si esa búsqueda no encuentra nada adecuado, vuelve a buscar sin el
filtro de medida para considerar otras opciones antiderrapantes en medidas distintas, y acláraselo al
cliente (ej. "en 20x20 no tengo esa opción, pero en 30x30 sí tengo..."). Si el cliente SÍ pide una medida
específica distinta a 20x20, respeta esa medida en vez de forzar 20x20.

Tu tema son ÚNICAMENTE: diseño de interiores, decoración, y todo lo relacionado a pisos, azulejos y baños
(tipos de material, combinación de colores, tendencias, cómo elegir medida/acabado según el espacio, tips
de instalación y mantenimiento). Si te preguntan algo fuera de ese tema, redirige amablemente la
conversación de vuelta a diseño de interiores/pisos.

Responde siempre en español, de forma breve, cálida y útil: uno o dos párrafos cortos como máximo, sin
usar encabezados ni listas con viñetas (esto se muestra en una burbuja de chat pequeña).`

// "gemini-flash-latest" apunta a un modelo muy nuevo con cuota gratuita
// de solo 20 solicitudes/día. "flash-lite" es más liviano y tiene una
// cuota gratuita bastante más generosa — mejor para este caso de uso.
const MODEL = 'gemini-flash-lite-latest'
const MAX_MESSAGE_LENGTH = 500
const MAX_HISTORY = 6
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

const TOOLS = [{
  functionDeclarations: [{
    name: 'buscar_pisos',
    description: 'Busca pisos/azulejos en el catálogo real de la tienda. "texto" busca de forma amplia en nombre, descripción y acabado (úsalo para características generales que no sean color, ej. "rústico", "para exterior"). Los demás parámetros son filtros exactos que se combinan entre sí. Devuelve hasta 8 resultados con precio, existencia y ACABADO reales. IMPORTANTE: si el cliente menciona un color, pásalo en "color". Para el PISO (suelo) de un baño/zona húmeda, usa siempre "texto: antiderrapante" — NO uses "acabado: Mate" para esto, ya que hay pisos Mate que NO son antiderrapantes. Si el cliente pide formato "cuadrado" o "rectangular" SIN pedir una medida exacta, usa el parámetro "formato" (no trates de adivinar cuáles medidas son cuadradas ni menciones en tu respuesta productos que la búsqueda no haya devuelto).',
    parameters: {
      type: 'OBJECT',
      properties: {
        texto: { type: 'STRING', description: 'Búsqueda libre en nombre, descripción y acabado del piso (no uses esto para colores)' },
        material: { type: 'STRING', enum: ['ceramica', 'porcelana'], description: 'Tipo de material' },
        marca: { type: 'STRING', description: 'Marca del piso, ej. Daltile, Cesantoni, Porcelanite' },
        medida: { type: 'STRING', description: 'Medida exacta del piso, ej. 30x60, 60x60. No la uses junto con "formato".' },
        formato: { type: 'STRING', enum: ['cuadrado', 'rectangular'], description: 'Usa esto cuando el cliente pida formato cuadrado o rectangular sin especificar una medida exacta.' },
        color: { type: 'STRING', description: 'Color del piso, ej. Blanco, Gris, Beige, Negro' },
        acabado: { type: 'STRING', description: 'Acabado del piso, ej. Mate, Brillante, Satinado. NO lo uses para pisos de baño/zonas húmedas — para eso usa "texto: antiderrapante", ya que no todo lo Mate es antiderrapante.' },
      },
    },
  }],
}]

interface HistoryMsg {
  role: 'user' | 'assistant'
  text: string
}

// Contacto de WhatsApp por bodega. "Plomería" todavía no tiene número — si
// se agrega después, solo hay que añadirlo aquí.
const BODEGA_CONTACTS: Record<string, { sucursal: string; whatsapp: string; ciudad: string }> = {
  'Matriz': { sucursal: 'Matriz', whatsapp: '4411302143', ciudad: 'Jalpan de Serra' },
  'Arroyo de Cañas': { sucursal: 'Daltile Store', whatsapp: '4411235096', ciudad: 'Jalpan de Serra' },
  'La Playita': { sucursal: 'Acabados y Materiales El Puente', whatsapp: '4411196933', ciudad: 'Jalpan de Serra' },
  'Lagunita': { sucursal: 'Cedis Lagunita', whatsapp: '4411543158', ciudad: 'Landa de Matamoros' },
}

interface ContactoSucursal {
  bodega: string
  sucursal: string
  whatsapp: string
  ciudad: string
}

interface ProductoEncontrado {
  id: string
  nombre: string
  imagen_url: string | null
  material: string
  color: string | null
  acabado: string | null
  marca: string | null
  medida: string | null
  precio_por_m2: number | null
  unidad: string
  stock_disponible: number
  en_existencia: boolean
  bodegas: { bodega: string; sucursal: string; stock: number }[]
}

async function buscarPisos(args: { texto?: string; material?: string; marca?: string; medida?: string; formato?: string; color?: string; acabado?: string }) {
  const supabase = await createServerSupabaseClient()
  const filtros: { brand_id?: string; size_id?: string } = {}

  let query = supabase
    .from('products')
    .select('id, name, image_url, material, color, finish, sale_unit, price_per_sqm, stock, brand:brands(name), size:sizes(label)')
    .eq('is_active', true)
    .order('stock', { ascending: false })
    .limit(8)

  // Igual que el buscador general de la página (/buscar): busca en nombre,
  // descripción y acabado a la vez, no solo en el nombre exacto.
  if (args.texto) {
    const like = likeSafe(args.texto)
    query = query.or(`name.ilike.${like},description.ilike.${like},finish.ilike.${like}`)
  }
  if (args.material === 'ceramica' || args.material === 'porcelana') query = query.eq('material', args.material)

  // El color "principal" vive en su propia columna, pero pisos con patrón/veta
  // mezclada (ej. "gris y negro") a veces solo mencionan el segundo color en
  // la descripción — por eso buscamos en ambos lados, no solo en la columna.
  if (args.color) {
    const like = likeSafe(args.color)
    query = query.or(`color.ilike.${like},description.ilike.${like}`)
  }

  // Filtro real de acabado (Mate/Brillante/Satinado/etc.) — más confiable que
  // buscar la palabra "antiderrapante" como texto libre, ya que muchos
  // productos con acabado Mate no usan esa palabra exacta en su descripción.
  if (args.acabado) query = query.ilike('finish', `%${args.acabado}%`)

  if (args.marca) {
    const { data: brand } = await supabase.from('brands').select('id').ilike('name', `%${args.marca}%`).limit(1).maybeSingle()
    if (!brand) return { productos: [] as ProductoEncontrado[], nota: `No encontré la marca "${args.marca}" en el catálogo.` }
    query = query.eq('brand_id', brand.id)
    filtros.brand_id = brand.id
  }

  if (args.medida) {
    const { data: size } = await supabase.from('sizes').select('id').ilike('label', `%${args.medida}%`).limit(1).maybeSingle()
    if (!size) return { productos: [] as ProductoEncontrado[], nota: `No encontré la medida "${args.medida}" en el catálogo.` }
    query = query.eq('size_id', size.id)
    filtros.size_id = size.id
  }

  // "Formato" (cuadrado/rectangular) no es una columna directa — se calcula
  // comparando ancho y alto de cada medida, por eso se resuelve a una lista de
  // size_id en vez de un filtro simple como los demás.
  if (args.formato === 'cuadrado' || args.formato === 'rectangular') {
    const { data: sizes } = await supabase.from('sizes').select('id, width, height')
    const sizeIds = (sizes || [])
      .filter(s => args.formato === 'cuadrado' ? s.width === s.height : s.width !== s.height)
      .map(s => s.id)
    if (sizeIds.length === 0) return { productos: [] as ProductoEncontrado[], nota: `No hay medidas de formato ${args.formato} en el catálogo.` }
    query = query.in('size_id', sizeIds)
  }

  const { data, error } = await query
  if (error) return { productos: [] as ProductoEncontrado[], error: error.message }
  if (!data || data.length === 0) return { productos: [] as ProductoEncontrado[], nota: 'No se encontraron pisos que coincidan con esa búsqueda.', filtros }

  const { data: bodegaRows } = await supabase
    .from('product_bodega_stock')
    .select('product_id, bodega, stock')
    .in('product_id', data.map(p => p.id))

  const bodegasPorProducto = new Map<string, { bodega: string; stock: number }[]>()
  ;(bodegaRows || []).forEach(r => {
    if (!bodegasPorProducto.has(r.product_id)) bodegasPorProducto.set(r.product_id, [])
    bodegasPorProducto.get(r.product_id)!.push({ bodega: r.bodega, stock: r.stock })
  })

  const productos: ProductoEncontrado[] = data.map(p => ({
    id: p.id,
    nombre: p.name,
    imagen_url: p.image_url,
    material: p.material,
    color: p.color,
    acabado: p.finish,
    marca: (p.brand as unknown as { name: string } | null)?.name || null,
    medida: (p.size as unknown as { label: string } | null)?.label || null,
    precio_por_m2: p.price_per_sqm,
    unidad: p.sale_unit === 'pieza' ? 'pieza' : 'caja',
    stock_disponible: p.stock,
    en_existencia: p.stock > 0,
    bodegas: (bodegasPorProducto.get(p.id) || []).map(b => ({
      bodega: b.bodega,
      sucursal: BODEGA_CONTACTS[b.bodega]?.sucursal || b.bodega,
      stock: b.stock,
    })),
  }))

  return { productos, filtros }
}

function quotaErrorReply(data: { error?: { code?: number; status?: string } }) {
  return data.error?.code === 429 || data.error?.status === 'RESOURCE_EXHAUSTED'
    ? 'El asistente está muy solicitado en este momento, intenta de nuevo en unos segundos.'
    : 'El asistente no pudo responder, intenta de nuevo.'
}

async function callGemini(contents: object[], allowTools = true) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      ...(allowTools
        ? { tools: TOOLS }
        : { tools: TOOLS, toolConfig: { functionCallingConfig: { mode: 'NONE' } } }),
      contents,
      generationConfig: {
        maxOutputTokens: 1536,
        // Más bajo que el default para que siga las reglas de negocio/seguridad
        // de forma más consistente (menos variación creativa en las respuestas).
        temperature: 0.4,
        // El modelo no permite desactivar el "pensamiento" por completo (thinkingBudget: 0
        // devuelve error en este modelo), así que lo dejamos bajo para no comerse el límite
        // de tokens de salida y cortar la respuesta a la mitad.
        thinkingConfig: { thinkingBudget: 128 },
      },
    }),
  })
  return res.json()
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

  const contents: object[] = [
    ...history.map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.text }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ]

  try {
    let data = await callGemini(contents)
    if (data.error) return NextResponse.json({ error: quotaErrorReply(data) }, { status: 502 })

    // Preguntas de seguimiento (ej. "¿y para el piso?" después de hablar de la pared)
    // pueden hacer que el modelo quiera buscar más de una vez en la misma respuesta,
    // así que permitimos varias rondas de function-calling en vez de solo una. Solo
    // nos quedamos con los resultados de la ÚLTIMA ronda que sí encontró algo (no
    // acumulamos todas las rondas): las rondas anteriores suelen ser intentos más
    // amplios que el modelo descarta al ir afinando filtros (medida/acabado/color),
    // así que mostrar esos resultados viejos junto a la respuesta final confunde —
    // el texto habla de lo que encontró al final, las tarjetas deben coincidir.
    let ultimosProductos: ProductoEncontrado[] = []
    let ultimaBusqueda: { args: Record<string, string>; filtros: { brand_id?: string; size_id?: string } } | null = null
    const MAX_TOOL_ROUNDS = 3

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const functionCallPart = data.candidates?.[0]?.content?.parts?.find((p: { functionCall?: unknown }) => p.functionCall)
      if (!functionCallPart || functionCallPart.functionCall?.name !== 'buscar_pisos') break

      const args = functionCallPart.functionCall.args || {}
      const resultado = await buscarPisos(args)
      if (resultado.productos.length > 0) {
        ultimosProductos = resultado.productos
        ultimaBusqueda = { args, filtros: resultado.filtros || {} }
      }

      contents.push({ role: 'model', parts: [functionCallPart] })
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: 'buscar_pisos', response: resultado } }],
      })

      data = await callGemini(contents)
      if (data.error) return NextResponse.json({ error: quotaErrorReply(data) }, { status: 502 })
    }

    // Si tras agotar las rondas el modelo sigue queriendo buscar (ej. no encuentra
    // coincidencia exacta y sigue probando variaciones de filtros), le forzamos una
    // respuesta de texto con lo que ya tiene en vez de devolver un error al usuario.
    if (data.candidates?.[0]?.content?.parts?.some((p: { functionCall?: unknown }) => p.functionCall)) {
      data = await callGemini(contents, false)
      if (data.error) return NextResponse.json({ error: quotaErrorReply(data) }, { status: 502 })
    }

    // El modelo, en casos raros, puede seguir sin devolver texto (incluso con las
    // llamadas a función forzadas a "NONE" arriba) — en vez de mostrarle un error
    // al usuario, damos una respuesta honesta genérica con lo que ya se encontró.
    const reply = data.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text
      || (ultimosProductos.length > 0
        ? 'Encontré esto que podría interesarte:'
        : 'No logré encontrar algo que coincida exactamente, ¿me das más detalles (color, medida, marca) o prefieres revisar el catálogo completo en la página?')

    // Mandamos los productos de la última búsqueda (tengan foto o no) para que el
    // widget muestre siempre una tarjeta con link a la página real del piso.
    const productosParaMostrar = ultimosProductos.slice(0, 6)

    // Enlace al catálogo completo con los mismos filtros de la última búsqueda,
    // para que el cliente pueda ver TODOS los resultados (aquí solo mostramos
    // hasta 6 tarjetas, pero puede haber más en existencia).
    let catalogoUrl: string | undefined
    if (ultimaBusqueda) {
      const qs = new URLSearchParams()
      if (ultimaBusqueda.args.texto) qs.set('search', ultimaBusqueda.args.texto)
      if (ultimaBusqueda.args.material === 'ceramica' || ultimaBusqueda.args.material === 'porcelana') qs.set('material', ultimaBusqueda.args.material)
      if (ultimaBusqueda.args.color) qs.set('color', ultimaBusqueda.args.color)
      if (ultimaBusqueda.args.acabado) qs.set('finish', ultimaBusqueda.args.acabado)
      if (ultimaBusqueda.args.formato === 'cuadrado' || ultimaBusqueda.args.formato === 'rectangular') qs.set('format', ultimaBusqueda.args.formato)
      if (ultimaBusqueda.filtros.brand_id) qs.set('brand_id', ultimaBusqueda.filtros.brand_id)
      if (ultimaBusqueda.filtros.size_id) qs.set('size_id', ultimaBusqueda.filtros.size_id)
      catalogoUrl = `/pisos?${qs.toString()}`
    }

    // Sucursales donde realmente hay stock de algo que se encontró, para
    // mostrar un botón directo de WhatsApp (sin exponer las que no tienen nada).
    const contactosPorBodega = new Map<string, ContactoSucursal>()
    productosParaMostrar.forEach(p => {
      p.bodegas.forEach(b => {
        if (b.stock <= 0) return
        const contacto = BODEGA_CONTACTS[b.bodega]
        if (contacto) contactosPorBodega.set(b.bodega, { bodega: b.bodega, ...contacto })
      })
    })

    return NextResponse.json({
      reply,
      productos: productosParaMostrar,
      contactos: Array.from(contactosPorBodega.values()),
      catalogoUrl,
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo conectar con el asistente' }, { status: 500 })
  }
}
