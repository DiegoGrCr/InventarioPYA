import { cookies } from 'next/headers'
import crypto from 'crypto'

const COOKIE_NAME = 'admin_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 días

function getSecret() {
  return process.env.SESSION_SECRET || ''
}

function sign(payload: string) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const hashBuffer = Buffer.from(hash, 'hex')
  const suppliedBuffer = crypto.scryptSync(password, salt, 64)
  return hashBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(hashBuffer, suppliedBuffer)
}

export async function createAdminSession(username: string) {
  const cookieStore = await cookies()
  const payload = `${username}.${Date.now()}`
  const signature = sign(payload)
  cookieStore.set(COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  })
}

export async function destroyAdminSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function isAdminSession() {
  const cookieStore = await cookies()
  const raw = cookieStore.get(COOKIE_NAME)?.value
  if (!raw) return false

  const lastDot = raw.lastIndexOf('.')
  if (lastDot === -1) return false
  const payload = raw.slice(0, lastDot)
  const signature = raw.slice(lastDot + 1)

  const expected = sign(payload)
  const sigBuffer = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return false
  }
  return true
}
