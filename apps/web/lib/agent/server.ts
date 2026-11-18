import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { getSiteOrigin } from '@/lib/seo/seo'
import { getSupabaseConfig } from '@/lib/supabase/config'
import { AgentError } from './contract'

export function agentDb() {
  const { url } = getSupabaseConfig()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Missing Kino agent database configuration')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function agentOrigin() {
  const url = new URL(process.env.KINO_AGENT_ORIGIN || getSiteOrigin())
  const loopback = url.protocol === 'http:' && url.hostname === 'localhost'
  if (
    (url.protocol !== 'https:' && !(process.env.NODE_ENV === 'development' && loopback)) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('Invalid Kino agent origin')
  }
  return url.origin
}

export function digest(text: string) {
  return createHash('sha256').update(text).digest('hex')
}

function originTag() {
  return digest(agentOrigin()).slice(0, 24)
}

export function issueToken() {
  return `kino_v1_${originTag()}_${randomBytes(32).toString('base64url')}`
}

export function bearerHash(request: Request) {
  const match = /^Bearer (kino_v1_([a-f0-9]{24})_[A-Za-z0-9_-]{43})$/i.exec(
    request.headers.get('authorization') ?? ''
  )
  if (!match || match[2] !== originTag()) throw new AgentError('unauthorized')
  return digest(match[1]!)
}

export async function agentRpc<T>(db: ReturnType<typeof agentDb>, name: string, args: object) {
  const { data, error } = await db.rpc(name, args)
  if (error) throw error
  return data as T
}
