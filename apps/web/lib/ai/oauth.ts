import 'server-only'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { type KinoLanguage, SUPPORTED_LANGUAGES } from '@kino/core/locale-config'
import { NextResponse } from 'next/server'
import { AgentError, readJson } from '@/lib/agent/contract'
import { agentDb, agentOrigin, agentRpc, digest } from '@/lib/agent/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AI_LOGIN_COOKIE, consentPath, flowCookie } from './continuation'

const oauthScopes = ['kino.read', 'kino.write']
const verifier = /^[A-Za-z0-9._~-]{43,128}$/
const nonce = /^[A-Za-z0-9_-]{43}$/
const noStore = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
type Client = { id: string; display_name: string; verified: boolean; redirect_uris: string[] }
type Decision = {
  client_name: string
  verified: boolean
  scopes: ('read' | 'write')[]
  enabled: boolean
}
type Callback = { redirect_uri: string; state: string | null }

const publishedClients = new Map([
  [
    'https://chatgpt.com/oauth/client.json',
    { name: 'ChatGPT', callbacks: ['https://chatgpt.com/connector_platform_oauth_redirect'] },
  ],
  [
    'https://claude.ai/api/oauth/mcp-oauth-client-metadata',
    { name: 'Claude', callbacks: ['https://claude.ai/api/mcp/auth_callback'] },
  ],
  [
    'https://chatgpt.com/oauth/codex/client.json',
    { name: 'Codex', callbacks: ['http://127.0.0.1/callback', 'http://localhost/callback'] },
  ],
])
const hostedCallbacks = [...publishedClients.values()]
  .flatMap((client) => client.callbacks)
  .filter((uri) => uri.startsWith('https:'))

export function resource() {
  return `${agentOrigin()}/mcp`
}
export function metadataUrl() {
  return `${agentOrigin()}/.well-known/oauth-protected-resource/mcp`
}

export function metadata(kind: 'issuer' | 'resource') {
  const issuer = agentOrigin()
  return Response.json(
    kind === 'resource'
      ? {
          resource: resource(),
          authorization_servers: [issuer],
          scopes_supported: oauthScopes,
          bearer_methods_supported: ['header'],
        }
      : {
          issuer,
          authorization_endpoint: `${issuer}/oauth/authorize`,
          token_endpoint: `${issuer}/oauth/token`,
          registration_endpoint: `${issuer}/oauth/register`,
          revocation_endpoint: `${issuer}/oauth/revoke`,
          client_id_metadata_document_supported: true,
          authorization_response_iss_parameter_supported: true,
          code_challenge_methods_supported: ['S256'],
          response_types_supported: ['code'],
          response_modes_supported: ['query'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          token_endpoint_auth_methods_supported: ['none'],
          revocation_endpoint_auth_methods_supported: ['none'],
          scopes_supported: oauthScopes,
        },
    { headers: noStore }
  )
}

function failure(error: string, status = 400) {
  return Response.json({ error }, { status, headers: noStore })
}

function callback(address: string, state: string | null, name: 'code' | 'error', value: string) {
  const url = new URL(address)
  url.searchParams.set('iss', agentOrigin())
  if (state !== null) url.searchParams.set('state', state)
  url.searchParams.set(name, value)
  return NextResponse.redirect(url, { status: 303, headers: noStore })
}

function localCallback(uri: string) {
  return (
    /^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):[0-9]{1,5}\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(
      uri
    ) &&
    (() => {
      try {
        return Boolean(new URL(uri).port)
      } catch {
        return false
      }
    })()
  )
}

async function getClient(id: string) {
  const pinned = publishedClients.get(id)
  if (pinned) {
    // Outbound requests are restricted to exact, owned metadata URLs.
    const response = await fetch(id, {
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 300 },
    })
    if (!response.ok) return null
    const doc = await response.json()
    const methods = doc.token_endpoint_auth_methods_supported ?? [doc.token_endpoint_auth_method]
    if (
      doc.client_id !== id ||
      !Array.isArray(doc.redirect_uris) ||
      !Array.isArray(methods) ||
      !methods.includes('none')
    )
      return null
    return {
      id,
      display_name: pinned.name,
      verified: true,
      redirect_uris: pinned.callbacks.filter((uri) => doc.redirect_uris.includes(uri)),
    }
  }
  if (!/^kino_mcp_[a-z0-9-]{36}$/.test(id)) return null
  const { data, error } = await agentDb()
    .from('kino_ai_clients')
    .select('id,display_name,verified,redirect_uris')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Client | null
}

function validRedirect(client: Client, redirect: string) {
  if (client.redirect_uris.includes(redirect)) return true
  if (!client.verified || !localCallback(redirect)) return false
  const callback = new URL(redirect)
  // RFC 8252 permits a variable port for a published native loopback callback.
  return (
    callback.hostname === '127.0.0.1' &&
    client.redirect_uris.includes(`http://127.0.0.1${callback.pathname}`)
  )
}

async function register(request: Request) {
  const input = (await readJson(request)) as Record<string, unknown> | null
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return failure('invalid_client_metadata')
  if (input.token_endpoint_auth_method !== undefined && input.token_endpoint_auth_method !== 'none')
    return failure('invalid_client_metadata')
  const redirects = input.redirect_uris
  if (
    !Array.isArray(redirects) ||
    redirects.length === 0 ||
    redirects.length > 5 ||
    redirects.some(
      (uri) => typeof uri !== 'string' || (!hostedCallbacks.includes(uri) && !localCallback(uri))
    )
  )
    return failure('invalid_redirect_uri')
  if (
    input.grant_types !== undefined &&
    (!Array.isArray(input.grant_types) ||
      !input.grant_types.includes('authorization_code') ||
      input.grant_types.some((g) => g !== 'authorization_code' && g !== 'refresh_token'))
  )
    return failure('invalid_client_metadata')
  if (
    input.response_types !== undefined &&
    (!Array.isArray(input.response_types) ||
      input.response_types.length !== 1 ||
      input.response_types[0] !== 'code')
  )
    return failure('invalid_client_metadata')
  const id = `kino_mcp_${randomUUID()}`
  const { error } = await agentDb()
    .from('kino_ai_clients')
    .insert({
      id,
      redirect_uris: [...new Set(redirects)],
      display_name: 'MCP client',
    })
  if (error) throw error
  return Response.json(
    {
      client_id: id,
      redirect_uris: [...new Set(redirects)],
      client_name: 'MCP client',
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    },
    { status: 201, headers: noStore }
  )
}

function hasDuplicate(params: URLSearchParams) {
  return new Set(params.keys()).size !== [...params.keys()].length
}

export async function authorize(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    if (request.url.length > 8192 || hasDuplicate(params)) return failure('invalid_request')
    const client = await getClient(params.get('client_id') ?? '')
    const redirect = params.get('redirect_uri')
    const state = params.get('state')
    if (
      !client ||
      !redirect ||
      !validRedirect(client, redirect) ||
      (state !== null && !/^[\x20-\x7e]{1,512}$/.test(state))
    )
      return failure('invalid_request')
    const fail = (code: string) => callback(redirect, state, 'error', code)
    if (params.get('response_type') !== 'code') return fail('unsupported_response_type')
    if (params.has('response_mode') && params.get('response_mode') !== 'query')
      return fail('invalid_request')
    if (params.get('resource') !== resource()) return fail('invalid_target')
    const challenge = params.get('code_challenge')
    if (params.get('code_challenge_method') !== 'S256' || !challenge || !nonce.test(challenge))
      return fail('invalid_request')
    const requested = (params.get('scope') ?? oauthScopes[0]!).split(' ')
    if (requested.some((scope) => !oauthScopes.includes(scope))) return fail('invalid_scope')
    const flow = randomUUID()
    const proof = randomBytes(32).toString('base64url')
    const { error } = await agentDb()
      .from('kino_ai_flows')
      .insert({
        id: flow,
        browser_hash: digest(proof),
        client_id: client.id,
        client_name: client.display_name,
        verified: client.verified,
        redirect_uri: redirect,
        resource: resource(),
        state,
        challenge,
        scopes: [...new Set(requested)].map((scope) => scope.slice(5)),
      })
    if (error) throw error
    const response = NextResponse.redirect(new URL(consentPath(flow)!, agentOrigin()), {
      status: 303,
      headers: noStore,
    })
    const settings = {
      secure: agentOrigin().startsWith('https:'),
      httpOnly: true,
      sameSite: 'lax' as const,
      maxAge: 900,
      path: '/',
    }
    response.cookies.set(flowCookie(flow), proof, settings)
    response.cookies.set(AI_LOGIN_COOKIE, flow, settings)
    return response
  } catch {
    return failure('temporarily_unavailable', 503)
  }
}

export async function browserUser() {
  const client = await createServerSupabaseClient()
  const { data } = await client.auth.getUser()
  return data.user
}

export async function loadBrowserConsent(flow: string, proof?: string) {
  if (!consentPath(flow) || !proof || !nonce.test(proof)) return { client: null }
  const user = await browserUser()
  if (!user) return { login: `/auth/login?ai_flow=${flow}` }
  return { client: await consent(flow, proof, user.id, 'view').catch(() => null) }
}

export function readCookie(request: Request, name: string) {
  return request.headers
    .get('cookie')
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(name + '='))
    ?.slice(name.length + 1)
}

export async function authPreference(userId: string) {
  const { data, error } = await agentDb()
    .from('kino_ai_preferences')
    .select('enabled')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.enabled === true
}

export function consent<T = Decision>(
  flow: string,
  proof: string,
  user: string,
  action: string,
  code?: string,
  language: KinoLanguage = 'en',
  timezone = 'UTC'
) {
  if (!consentPath(flow) || !nonce.test(proof)) return Promise.resolve(null)
  return agentRpc<T | null>(agentDb(), 'kino_ai_consent', {
    p_flow: flow,
    p_browser: digest(proof),
    p_user: user,
    p_decision: action,
    p_code_hash: code ? digest(code) : null,
    p_language: language,
    p_timezone: timezone,
  })
}

async function form(request: Request) {
  if (
    !/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(
      request.headers.get('content-type') ?? ''
    ) ||
    !request.body
  )
    return null
  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0
  let value = ''
  for (;;) {
    const chunk = await reader.read()
    if (chunk.done) break
    size += chunk.value.byteLength
    if (size > 8192) {
      await reader.cancel()
      return null
    }
    value += decoder.decode(chunk.value, { stream: true })
  }
  const params = new URLSearchParams(value + decoder.decode())
  return hasDuplicate(params) ? null : params
}

async function token(params: URLSearchParams, request: Request) {
  if (
    request.headers.has('authorization') ||
    params.has('client_secret') ||
    params.has('client_assertion')
  )
    return failure('invalid_client', 401)
  const kind = params.get('grant_type')
  if (kind !== 'authorization_code' && kind !== 'refresh_token')
    return failure('unsupported_grant_type')
  const client = params.get('client_id')
  const secret = params.get(kind === 'authorization_code' ? 'code' : 'refresh_token')
  const proof = params.get('code_verifier')
  const redirect = params.get('redirect_uri')
  if (
    !client ||
    !secret ||
    !nonce.test(secret) ||
    (kind === 'authorization_code' && (!proof || !verifier.test(proof) || !redirect))
  )
    return failure('invalid_request')
  if (params.has('resource') && params.get('resource') !== resource())
    return failure('invalid_target')
  if (kind === 'authorization_code' && !params.has('resource')) return failure('invalid_target')
  const requested = params.get('scope')?.split(' ')
  if (requested?.some((scope) => !oauthScopes.includes(scope))) return failure('invalid_scope')
  if (requested && kind === 'authorization_code') return failure('invalid_request')
  const access = `kino_mcp_${randomBytes(32).toString('base64url')}`
  const refresh = randomBytes(32).toString('base64url')
  const result = await agentRpc<{
    scopes: string[]
    expires_in: number
    error?: 'invalid_scope'
  } | null>(agentDb(), 'kino_ai_exchange', {
    p_kind: kind,
    p_hash: digest(secret),
    p_client: client,
    p_redirect: redirect,
    p_challenge: proof ? createHash('sha256').update(proof).digest('base64url') : null,
    p_resource: resource(),
    p_access_hash: digest(access),
    p_refresh_hash: digest(refresh),
    p_requested: requested ? [...new Set(requested)].map((scope) => scope.slice(5)) : null,
  })
  if (!result) return failure('invalid_grant')
  if (result.error) return failure(result.error)
  return Response.json(
    {
      access_token: access,
      refresh_token: refresh,
      token_type: 'Bearer',
      expires_in: result.expires_in,
      scope: result.scopes.map((scope) => `kino.${scope}`).join(' '),
    },
    { headers: noStore }
  )
}

async function browserPost(request: Request, action: string, params: URLSearchParams) {
  if (request.headers.get('origin') !== agentOrigin()) return failure('invalid_request', 403)
  const user = await browserUser()
  if (!user) return failure('login_required', 401)
  if (action === 'settings') {
    const enabled = params.get('enabled')
    if (enabled !== 'true' && enabled !== 'false') return failure('invalid_request')
    await agentRpc(agentDb(), 'kino_ai_set_enabled', {
      p_user: user.id,
      p_enabled: enabled === 'true',
    })
    return Response.json({ enabled: enabled === 'true' }, { headers: noStore })
  }
  const flow = params.get('flow') ?? ''
  const path = consentPath(flow)
  const proof = readCookie(request, flowCookie(flow))
  const decision = params.get('decision')
  if (!path || !proof || (decision !== 'approve' && decision !== 'deny' && decision !== 'enable'))
    return failure('invalid_request')
  const code = randomBytes(32).toString('base64url')
  const chosen = readCookie(request, 'kino-language') as KinoLanguage
  const language = SUPPORTED_LANGUAGES.includes(chosen) ? chosen : 'en'
  const zone = params.get('timezone') ?? 'UTC'
  if (decision === 'enable') {
    if (!(await consent(flow, proof, user.id, decision))) return failure('invalid_request')
    return NextResponse.redirect(new URL(path, agentOrigin()), { status: 303, headers: noStore })
  }
  const result = await consent<Callback>(
    flow,
    proof,
    user.id,
    decision,
    code,
    language,
    zone.slice(0, 80)
  )
  if (!result) return failure('invalid_request')
  const response = callback(
    result.redirect_uri,
    result.state,
    decision === 'approve' ? 'code' : 'error',
    decision === 'approve' ? code : 'access_denied'
  )
  response.cookies.delete(flowCookie(flow))
  if (readCookie(request, AI_LOGIN_COOKIE) === flow) response.cookies.delete(AI_LOGIN_COOKIE)
  return response
}

export async function oauthPost(request: Request, action: string) {
  try {
    if (new URL(request.url).search) return failure('invalid_request')
    if (action === 'register') return await register(request)
    if (!['token', 'revoke', 'consent', 'settings'].includes(action))
      return failure('invalid_request', 404)
    const params = await form(request)
    if (!params) return failure('invalid_request')
    if (action === 'token') return await token(params, request)
    if (action === 'revoke') {
      const client = params.get('client_id')
      const supplied = params.get('token')
      if (
        !client ||
        !supplied ||
        request.headers.has('authorization') ||
        params.has('client_secret')
      )
        return failure('invalid_request')
      await agentRpc(agentDb(), 'kino_ai_revoke', {
        p_hash: digest(supplied),
        p_client: client,
        p_resource: resource(),
      })
      return new Response(null, { status: 200, headers: noStore })
    }
    return await browserPost(request, action, params)
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      error instanceof TypeError ||
      (error instanceof AgentError && error.code === 'validation_error')
    )
      return failure('invalid_request')
    return failure('temporarily_unavailable', 503)
  }
}
