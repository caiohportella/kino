import 'server-only'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { type KinoLanguage, SUPPORTED_LANGUAGES } from '@kino/core/locale-config'
import { NextResponse } from 'next/server'
import { AgentError, readJson } from '@/lib/agent/contract'
import {
  AgentDatabaseConfigError,
  agentDb,
  agentOrigin,
  agentRpc,
  digest,
} from '@/lib/agent/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  AI_LOGIN_COOKIE,
  consentLoginPath,
  consentPath,
  flowCookie,
  hasConsentProof,
} from './continuation'

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
type AuthorizationStage =
  | 'request_validation'
  | 'client_metadata'
  | 'database_client'
  | 'authorization_flow_insert'
  | 'consent_redirect'

class ClientMetadataError extends Error {
  constructor(readonly status?: number) {
    super('Invalid published client metadata')
  }
}

class AuthorizationDatabaseError extends Error {
  readonly databaseCode?: string
  readonly databaseStatus?: number

  constructor(code: unknown, status: number) {
    super('Authorization database request failed')
    if (
      typeof code === 'string' &&
      (code.length === 5 || code.length === 8) &&
      /^(?:(?:[0-9][0-9A-Z]|F0|HV|P0|XX)[0-9A-Z]{3}|PGRST[0-9]{3})$/.test(code)
    ) {
      this.databaseCode = code
    }
    if (Number.isInteger(status) && status >= 400 && status <= 599) this.databaseStatus = status
  }
}

function reportAuthorizationFailure(requestId: string, stage: AuthorizationStage, error: unknown) {
  let errorType = 'unexpected_error'
  if (error instanceof AgentDatabaseConfigError) errorType = error.reason
  else if (error instanceof AuthorizationDatabaseError) errorType = 'database_request_error'
  else if (error instanceof ClientMetadataError)
    errorType =
      error.status === undefined ? 'invalid_client_document' : 'client_metadata_http_error'
  else if (error instanceof SyntaxError) errorType = 'invalid_json'
  else if (error instanceof DOMException && error.name === 'TimeoutError') errorType = 'timeout'
  else if (error instanceof DOMException && error.name === 'AbortError') errorType = 'aborted'
  else if (error instanceof TypeError) errorType = 'type_error'

  console.error('kino.oauth.authorization_failed', {
    requestId,
    stage,
    errorType,
    ...(error instanceof AuthorizationDatabaseError && {
      databaseCode: error.databaseCode,
      databaseStatus: error.databaseStatus,
    }),
    ...(error instanceof ClientMetadataError &&
      error.status !== undefined && {
        upstreamStatus: error.status,
      }),
  })
}

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

function failure(error: string, status = 400, requestId?: string) {
  const headers = new Headers(noStore)
  if (requestId) headers.set('X-Request-Id', requestId)
  return Response.json({ error }, { status, headers })
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

async function getClient(id: string, getDb: typeof agentDb) {
  const pinned = publishedClients.get(id)
  if (pinned) {
    // Outbound requests are restricted to exact, owned metadata URLs.
    const response = await fetch(id, {
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 300 },
    })
    if (!response.ok) throw new ClientMetadataError(response.status)
    const doc = (await response.json()) as Record<string, unknown> | null
    const methods = doc?.token_endpoint_auth_methods_supported ?? [doc?.token_endpoint_auth_method]
    if (
      doc?.client_id !== id ||
      !Array.isArray(doc.redirect_uris) ||
      !Array.isArray(methods) ||
      !methods.includes('none')
    )
      throw new ClientMetadataError()
    const redirects = doc.redirect_uris
    const matchingCallbacks = pinned.callbacks.filter((uri) => redirects.includes(uri))
    if (matchingCallbacks.length === 0) throw new ClientMetadataError()
    return {
      id,
      display_name: pinned.name,
      verified: true,
      redirect_uris: matchingCallbacks,
    }
  }
  if (!/^kino_mcp_[a-z0-9-]{36}$/.test(id)) return null
  const { data, error, status } = await getDb()
    .from('kino_ai_clients')
    .select('id,display_name,verified,redirect_uris')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new AuthorizationDatabaseError(error.code, status)
  return data as Client | null
}

function validRedirect(client: Client, redirect: string) {
  if (client.redirect_uris.includes(redirect)) return true
  if (!client.verified || !localCallback(redirect)) return false
  const callback = new URL(redirect)
  // RFC 8252 permits a variable port for a published native loopback callback.
  return client.redirect_uris.includes(`http://${callback.hostname}${callback.pathname}`)
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
  const requestId = randomUUID()
  let stage: AuthorizationStage = 'request_validation'
  let db: ReturnType<typeof agentDb> | undefined
  const getDb = () => {
    if (db) return db
    const previousStage = stage
    stage = 'database_client'
    db = agentDb()
    stage = previousStage
    return db
  }
  try {
    const params = new URL(request.url).searchParams
    if (request.url.length > 8192 || hasDuplicate(params)) return failure('invalid_request')
    stage = 'client_metadata'
    const client = await getClient(params.get('client_id') ?? '', getDb)
    stage = 'request_validation'
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
    const origin = agentOrigin()
    const audience = `${origin}/mcp`
    if (params.get('resource') !== audience) return fail('invalid_target')
    const challenge = params.get('code_challenge')
    if (params.get('code_challenge_method') !== 'S256' || !challenge || !nonce.test(challenge))
      return fail('invalid_request')
    const requested = (params.get('scope') ?? oauthScopes[0]!).split(' ')
    if (requested.some((scope) => !oauthScopes.includes(scope))) return fail('invalid_scope')
    const flow = randomUUID()
    const proof = randomBytes(32).toString('base64url')
    stage = 'authorization_flow_insert'
    const { error, status } = await getDb()
      .from('kino_ai_flows')
      .insert({
        id: flow,
        browser_hash: digest(proof),
        client_id: client.id,
        client_name: client.display_name,
        verified: client.verified,
        redirect_uri: redirect,
        resource: audience,
        state,
        challenge,
        scopes: [...new Set(requested)].map((scope) => scope.slice(5)),
      })
    if (error) throw new AuthorizationDatabaseError(error.code, status)
    stage = 'consent_redirect'
    const response = NextResponse.redirect(new URL(consentPath(flow)!, origin), {
      status: 303,
      headers: noStore,
    })
    const settings = {
      secure: origin.startsWith('https:'),
      httpOnly: true,
      sameSite: 'lax' as const,
      maxAge: 900,
      path: '/',
    }
    response.cookies.set(flowCookie(flow), proof, settings)
    response.cookies.set(AI_LOGIN_COOKIE, flow, settings)
    return response
  } catch (error) {
    reportAuthorizationFailure(requestId, stage, error)
    if (error instanceof ClientMetadataError && error.status !== 429 && (error.status ?? 0) < 500)
      return failure('invalid_request', 400, requestId)
    return failure('temporarily_unavailable', 503, requestId)
  }
}

export async function browserUser() {
  const client = await createServerSupabaseClient()
  const { data } = await client.auth.getUser()
  return data.user
}

export async function loadBrowserConsent(flow: string, proof?: string) {
  if (!hasConsentProof(flow, proof)) return { client: null }
  const user = await browserUser()
  if (!user) return { login: consentLoginPath(flow) }
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
  if (!hasConsentProof(flow, proof)) return Promise.resolve(null)
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
    )
  )
    return { reason: 'invalid_form_content_type' } as const
  if (!request.body) return { reason: 'missing_form_body' } as const
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
      return { reason: 'form_too_large' } as const
    }
    value += decoder.decode(chunk.value, { stream: true })
  }
  const params = new URLSearchParams(value + decoder.decode())
  return hasDuplicate(params) ? ({ reason: 'duplicate_parameter', params } as const) : { params }
}

function tokenRejection(
  requestId: string,
  error: string,
  reason: string,
  params?: URLSearchParams,
  status = 400
) {
  if (process.env.NODE_ENV === 'development') {
    const grant = params?.get('grant_type')
    const proof = params?.get('code_verifier')
    console.warn('kino.oauth.token_rejected', {
      requestId,
      error,
      status,
      reason,
      grantType: grant === 'authorization_code' || grant === 'refresh_token' ? grant : null,
      presence: params
        ? {
            resource: params.has('resource'),
            clientId: params.has('client_id'),
            codeVerifier: params.has('code_verifier'),
            redirectUri: params.has('redirect_uri'),
            scope: params.has('scope'),
            code: params.has('code'),
            refreshToken: params.has('refresh_token'),
          }
        : null,
      validCodeVerifier: proof === null || proof === undefined ? null : verifier.test(proof),
    })
  }
  return failure(error, status, requestId)
}

async function token(params: URLSearchParams, request: Request, requestId: string) {
  const reject = (error: string, reason: string, status?: number) =>
    tokenRejection(requestId, error, reason, params, status)
  if (
    request.headers.has('authorization') ||
    params.has('client_secret') ||
    params.has('client_assertion')
  )
    return reject('invalid_client', 'unsupported_client_authentication', 401)
  const kind = params.get('grant_type')
  if (kind !== 'authorization_code' && kind !== 'refresh_token')
    return reject('unsupported_grant_type', 'unsupported_grant')
  const client = params.get('client_id')
  const secret = params.get(kind === 'authorization_code' ? 'code' : 'refresh_token')
  const proof = params.get('code_verifier')
  const redirect = params.get('redirect_uri')
  if (!client) return reject('invalid_request', 'missing_client_id')
  if (!secret || !nonce.test(secret)) return reject('invalid_request', 'invalid_grant_token_format')
  if (kind === 'authorization_code' && (!proof || !verifier.test(proof)))
    return reject('invalid_request', 'missing_or_malformed_code_verifier')
  if (kind === 'authorization_code' && !redirect)
    return reject('invalid_request', 'missing_redirect_uri')
  const audience = resource()
  if (params.has('resource') && params.get('resource') !== audience)
    return reject('invalid_target', 'resource_mismatch')
  // RFC 8707 allows a single-resource server to use the audience already bound to the grant.
  // The exchange RPC still requires this audience to match the approved flow or refresh grant.
  const requested = params.get('scope')?.split(' ')
  if (requested?.some((scope) => !oauthScopes.includes(scope)))
    return reject('invalid_scope', 'unsupported_scope')
  if (requested && kind === 'authorization_code')
    return reject('invalid_request', 'scope_on_code_exchange')
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
    p_resource: audience,
    p_access_hash: digest(access),
    p_refresh_hash: digest(refresh),
    p_requested: requested ? [...new Set(requested)].map((scope) => scope.slice(5)) : null,
  })
  if (!result) return reject('invalid_grant', 'grant_rejected_by_database')
  if (result.error) return reject('invalid_scope', 'scope_exceeds_grant')
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
  const requestId = action === 'token' ? randomUUID() : undefined
  let tokenParams: URLSearchParams | undefined
  try {
    if (new URL(request.url).search)
      return requestId
        ? tokenRejection(requestId, 'invalid_request', 'unexpected_query_parameters')
        : failure('invalid_request')
    if (action === 'register') return await register(request)
    if (!['token', 'revoke', 'consent', 'settings'].includes(action))
      return failure('invalid_request', 404)
    const parsed = await form(request)
    if (parsed.reason)
      return requestId
        ? tokenRejection(requestId, 'invalid_request', parsed.reason, parsed.params)
        : failure('invalid_request')
    const { params } = parsed
    if (requestId) {
      tokenParams = params
      return await token(params, request, requestId)
    }
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
      return requestId
        ? tokenRejection(
            requestId,
            'invalid_request',
            tokenParams ? 'invalid_token_request' : 'invalid_form_encoding',
            tokenParams
          )
        : failure('invalid_request')
    return requestId
      ? tokenRejection(
          requestId,
          'temporarily_unavailable',
          'token_exchange_unavailable',
          tokenParams,
          503
        )
      : failure('temporarily_unavailable', 503)
  }
}
