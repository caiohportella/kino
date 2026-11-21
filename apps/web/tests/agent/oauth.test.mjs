import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { GET as issuerMetadata } from '../../app/.well-known/oauth-authorization-server/route.ts'
import { GET as resourceMetadata } from '../../app/.well-known/oauth-protected-resource/[[...path]]/route.ts'
import { POST as mcp } from '../../app/mcp/route.ts'
import { GET as authorize, POST as oauth } from '../../app/oauth/[action]/route.ts'
import { digest } from '../../lib/agent/server.ts'
import { flowCookie } from '../../lib/ai/continuation.ts'
import { loadBrowserConsent } from '../../lib/ai/oauth.ts'
import { createServerSupabaseClient } from '../../lib/supabase/server.ts'
import { catalogFixture } from './catalog-fixture.mjs'
import { clientDocuments } from './client-documents.mjs'
import { createFixtureAuth, fixtureUsers, fixtureJwt as jwt } from './fixture-auth.mjs'
import { withCookies } from './fixture-cookies.mjs'

const owner = 'd0000000-0000-4000-8000-000000000000'
const other = 'e0000000-0000-4000-8000-000000000000'
const redirect = 'http://127.0.0.1:40901/callback'
const context = (action) => ({ params: Promise.resolve({ action }) })
const clientIdUrl = clientDocuments.chatgpt.client_id
const clientCallback = clientDocuments.chatgpt.redirect_uris[0]
const codexIdUrl = clientDocuments.codex.client_id

function callback(response) {
  return new URL(response.headers.get('location'))
}

test('Kino OAuth lifecycle through Next route handlers and the MCP SDK', async (t) => {
  const server = createServer(async (incoming, outgoing) => {
    const chunks = []
    for await (const chunk of incoming) chunks.push(chunk)
    const response = await mcp(
      new Request(resource, {
        method: incoming.method,
        headers: incoming.headers,
        body: Buffer.concat(chunks),
      })
    )
    outgoing.writeHead(response.status, Object.fromEntries(response.headers))
    outgoing.end(Buffer.from(await response.arrayBuffer()))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())
  const origin = `http://localhost:${server.address().port}`
  const resource = origin + '/mcp'
  const rest = new URL(process.env.KINO_AGENT_TEST_POSTGREST_URL)
  const jwtSecret = process.env.KINO_AGENT_TEST_JWT_SECRET
  const fixtureAuth = createFixtureAuth(jwtSecret)
  assert.equal(rest.hostname, '127.0.0.1')
  assert.equal(rest.protocol, 'http:')
  assert.ok(jwtSecret?.length >= 32)
  process.env.KINO_AGENT_ORIGIN = origin
  process.env.NODE_ENV = 'development'
  process.env.NEXT_PUBLIC_SUPABASE_URL = rest.origin
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = jwt('anon', jwtSecret)
  process.env.SUPABASE_SERVICE_ROLE_KEY = jwt('service_role', jwtSecret)
  process.env.TMDB_API_KEY = 'fixture-only'
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    if (url.origin === 'https://api.themoviedb.org') return catalogFixture(url)
    const metadata = Object.values(clientDocuments).find((doc) => doc.client_id === url.href)
    if (metadata) return Response.json({ ...metadata, client_name: 'Ignored remote label' })
    assert.equal(url.origin, rest.origin)
    if (url.pathname.startsWith('/auth/v1/')) return fixtureAuth.handle(new Request(url, init))
    url.pathname = url.pathname.replace(/^\/rest\/v1/, '')
    return originalFetch(url, init)
  }
  t.after(() => {
    globalThis.fetch = originalFetch
  })
  const db = createClient(rest.origin, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  async function rows(query) {
    const { data, error } = await query
    assert.equal(error, null, error?.message)
    return data
  }

  const cookies = new Map()
  const alternate = new Map()
  const cookieHeader = (jar) => [...jar].map(([key, value]) => key + '=' + value).join('; ')
  async function signIn(jar, id) {
    await withCookies(jar, async () => {
      const auth = await createServerSupabaseClient()
      const response = await auth.auth.signInWithPassword({
        email: fixtureUsers.find((user) => user.id === id).email,
        password: fixtureAuth.password,
      })
      assert.equal(response.error, null)
      assert.equal(response.data.user.id, id)
      const refreshed = await auth.auth.refreshSession()
      assert.equal(refreshed.error, null)
      assert.equal(refreshed.data.user.id, id)
      assert.notEqual(refreshed.data.session.refresh_token, response.data.session.refresh_token)
    })
  }
  function post(action, body, jar = cookies, headers = {}) {
    return withCookies(jar, () =>
      oauth(
        new Request(origin + '/oauth/' + action, {
          method: 'POST',
          headers: { origin, cookie: cookieHeader(jar), ...headers },
          body: new URLSearchParams(body),
        }),
        context(action)
      )
    )
  }

  const register = (metadata) =>
    oauth(
      new Request(origin + '/oauth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      }),
      context('register')
    )

  const registration = await register({
    redirect_uris: [redirect],
    client_name: 'ChatGPT',
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
  })
  assert.equal(registration.status, 201)
  const clientId = (await registration.json()).client_id

  async function start(scopes = 'kino.read kino.write', override = {}) {
    const proof = randomBytes(50).toString('base64url')
    const target = new URL(origin + '/oauth/authorize')
    target.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirect,
      resource,
      code_challenge: createHash('sha256').update(proof).digest('base64url'),
      code_challenge_method: 'S256',
      scope: scopes,
      state: 'fixture-csrf-state',
      ...override,
    })
    const response = await authorize(new Request(target), context('authorize'))
    if (response.status !== 303 || callback(response).origin !== origin) return { response }
    const flow = callback(response).searchParams.get('flow')
    for (const header of response.headers.getSetCookie()) {
      const [name, value] = header.split(';', 1)[0].split('=')
      cookies.set(name, value)
      assert.match(header, /HttpOnly/i)
    }
    return { response, flow, proof }
  }

  await t.test('published clients use exact callbacks and registered loopback ports', async () => {
    for (const redirect_uri of [
      'http://127.0.0.1:63457/callback',
      'http://localhost:43210/callback',
    ]) {
      const { flow, response } = await start('kino.read', { client_id: codexIdUrl, redirect_uri })
      assert.equal(response.status, 303)
      assert.ok(flow)
      assert.equal(callback(response).pathname, '/auth/authorize')
    }
    for (const redirect_uri of [
      'http://127.0.0.1:43210/different',
      'http://localhost:43210/callback?next=elsewhere',
      'http://[::1]:43210/callback',
    ]) {
      const { response } = await start('kino.read', { client_id: codexIdUrl, redirect_uri })
      assert.equal(response.status, 400)
      assert.equal(response.headers.has('location'), false)
    }
  })

  await t.test(
    'authorization logs safe, correlated diagnostics for each failure stage',
    async (t) => {
      const unsafe = 'fixture-sensitive-material'
      const log = t.mock.method(console, 'error', () => {})
      const published = { client_id: clientIdUrl, redirect_uri: clientCallback, state: unsafe }
      const check = async (expected, status = 503) => {
        const count = log.mock.callCount()
        const { response } = await start('kino.read', published)
        const requestId = response.headers.get('x-request-id')
        assert.equal(response.status, status)
        assert.equal(response.headers.get('cache-control'), 'no-store')
        assert.equal(response.headers.has('location'), false)
        assert.match(requestId, /^[a-f0-9-]{36}$/)
        assert.deepEqual(await response.json(), {
          error: status === 503 ? 'temporarily_unavailable' : 'invalid_request',
        })
        assert.equal(log.mock.callCount(), count + 1)
        const [event, fields] = log.mock.calls.at(-1).arguments
        assert.equal(event, 'kino.oauth.authorization_failed')
        assert.deepEqual(JSON.parse(JSON.stringify(fields)), { requestId, ...expected })
        assert.ok(!JSON.stringify(fields).includes(unsafe))
      }

      const fixtureFetch = globalThis.fetch
      const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      try {
        globalThis.fetch = async (input, init) => {
          if (String(input) === clientIdUrl) throw new DOMException(unsafe, 'TimeoutError')
          return fixtureFetch(input, init)
        }
        await check({ stage: 'client_metadata', errorType: 'timeout' })

        globalThis.fetch = async (input, init) =>
          String(input) === clientIdUrl ? Response.json(null) : fixtureFetch(input, init)
        await check({ stage: 'client_metadata', errorType: 'invalid_client_document' }, 400)
        globalThis.fetch = async (input, init) =>
          String(input) === clientIdUrl
            ? new Response(unsafe, { status: 503 })
            : fixtureFetch(input, init)
        await check({
          stage: 'client_metadata',
          errorType: 'client_metadata_http_error',
          upstreamStatus: 503,
        })
        globalThis.fetch = fixtureFetch

        delete process.env.SUPABASE_SERVICE_ROLE_KEY
        await check({ stage: 'database_client', errorType: 'missing_service_role_key' })
        process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRole

        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        const { flow } = await start('kino.read', published)
        assert.ok(flow, 'published-client authorization only needs the privileged database key')
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey

        for (const [code, sanitized] of [
          ['PGRST205', { databaseCode: 'PGRST205' }],
          [unsafe, {}],
        ]) {
          globalThis.fetch = async (input, init) => {
            if (
              new URL(input instanceof Request ? input.url : input).pathname.endsWith(
                '/kino_ai_flows'
              )
            )
              return Response.json(
                { code, message: unsafe, details: unsafe, hint: unsafe },
                { status: 404 }
              )
            return fixtureFetch(input, init)
          }
          await check({
            stage: 'authorization_flow_insert',
            errorType: 'database_request_error',
            databaseStatus: 404,
            ...sanitized,
          })
        }
        globalThis.fetch = fixtureFetch

        t.mock.method(NextResponse, 'redirect', () => {
          throw new TypeError(unsafe)
        })
        await check({ stage: 'consent_redirect', errorType: 'type_error' })
      } finally {
        globalThis.fetch = fixtureFetch
        process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRole
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey
      }
    }
  )

  const view = (flow, jar = cookies) =>
    withCookies(jar, () => loadBrowserConsent(flow, jar.get(flowCookie(flow))))
  const decision = (flow, choice, jar = cookies, headers) =>
    post(
      'consent',
      {
        flow,
        decision: choice,
        timezone: 'America/Sao_Paulo',
      },
      jar,
      headers
    )
  const exchange = (code, challenge, override = {}) =>
    post('token', {
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      code_verifier: challenge,
      redirect_uri: redirect,
      resource,
      ...override,
    })
  const codexRedirect = 'http://127.0.0.1:63457/callback'
  const codexExchange = (code, proof, override = {}) =>
    post('token', {
      grant_type: 'authorization_code',
      client_id: codexIdUrl,
      code,
      code_verifier: proof,
      redirect_uri: codexRedirect,
      ...override,
    })
  const refresh = (token) =>
    post('token', {
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: token,
      resource,
    })
  async function approve(scopes) {
    const { flow, proof } = await start(scopes)
    assert.equal((await view(flow)).client.enabled, true)
    const granted = await decision(flow, 'approve')
    assert.equal(granted.status, 303)
    assert.equal(callback(granted).searchParams.get('state'), 'fixture-csrf-state')
    assert.equal(callback(granted).searchParams.get('iss'), origin)
    const response = await exchange(callback(granted).searchParams.get('code'), proof)
    assert.equal(response.status, 200, await response.clone().text())
    return response.json()
  }

  async function requestMcp(token, method, params, modern = false) {
    const headers = {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
    }
    if (token) headers.authorization = 'Bearer ' + token
    if (modern) {
      headers['mcp-protocol-version'] = '2026-07-28'
      headers['mcp-method'] = method
      if (params.name) headers['mcp-name'] = params.name
      params = {
        ...params,
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientInfo': { name: 'Fixture', version: '1' },
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      }
    }
    const response = await originalFetch(resource, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    const body = await response.text()
    const data = response.headers.get('content-type')?.includes('text/event-stream')
      ? JSON.parse(
          body
            .split('\n')
            .find((row) => row.startsWith('data: '))
            .slice(6)
        )
      : JSON.parse(body)
    return { response, data }
  }
  const call = (token, name, args, modern = false) =>
    requestMcp(token, 'tools/call', { name, arguments: args }, modern)
  const contents = (reply) => {
    assert.equal(reply.response.status, 200, JSON.stringify(reply.data))
    assert.ok(reply.data.result, JSON.stringify(reply.data))
    return reply.data.result.structuredContent
  }

  await t.test(
    'discovery, published identity, constrained registration and invalid authorization',
    async () => {
      const issuer = await issuerMetadata().json()
      const pr = await (
        await resourceMetadata(new Request(resource), {
          params: Promise.resolve({ path: ['mcp'] }),
        })
      ).json()
      assert.deepEqual(pr.authorization_servers, [issuer.issuer])
      assert.equal(pr.resource, resource)
      assert.deepEqual(issuer.code_challenge_methods_supported, ['S256'])
      assert.equal(issuer.client_id_metadata_document_supported, true)
      const challenge = await requestMcp(null, 'tools/list', {})
      assert.equal(challenge.response.status, 401)
      assert.match(
        challenge.response.headers.get('www-authenticate'),
        /oauth-protected-resource\/mcp/
      )
      assert.equal(
        (await register({ redirect_uris: ['https://untrusted.example/callback'] })).status,
        400
      )
      assert.equal(
        (await start('kino.read', { redirect_uri: redirect + 'x' })).response.status,
        400
      )
      assert.equal(
        (await start('kino.read', { client_id: 'https://untrusted.example/client.json' })).response
          .status,
        400
      )
      assert.equal(
        callback((await start('kino.admin')).response).searchParams.get('error'),
        'invalid_scope'
      )
      assert.equal(
        callback(
          (await start('kino.read', { resource: origin + '/elsewhere' })).response
        ).searchParams.get('error'),
        'invalid_target'
      )
      assert.equal(
        callback(
          (await start('kino.read', { code_challenge_method: 'plain' })).response
        ).searchParams.get('error'),
        'invalid_request'
      )
      const published = await start('kino.read', {
        client_id: clientIdUrl,
        redirect_uri: clientCallback,
      })
      const browser = new Map(cookies)
      await signIn(browser, other)
      assert.equal((await view(published.flow, browser)).client.client_name, 'ChatGPT')
      assert.equal((await view(published.flow, browser)).client.verified, true)
    }
  )

  let connection
  await t.test(
    'sign-in continuation, explicit enable and consent, one-time code and PKCE',
    async (t) => {
      const { flow, proof } = await start()
      assert.equal((await view(flow)).login, '/auth/login?ai_flow=' + flow)
      assert.equal((await view(flow, new Map())).client, null)
      assert.equal((await decision(flow, 'approve')).status, 401)
      await signIn(cookies, owner)
      const permission = (await view(flow)).client
      assert.deepEqual(permission, {
        client_name: 'MCP client',
        verified: false,
        scopes: ['read', 'write'],
        enabled: false,
      })
      assert.equal((await decision(flow, 'approve')).status, 400)
      assert.equal(
        (await decision(flow, 'enable', cookies, { origin: 'https://untrusted.example' })).status,
        403
      )
      assert.equal((await decision(flow, 'enable')).status, 303)
      assert.equal((await view(flow)).client.enabled, true)
      const browser = new Map(cookies)
      await signIn(browser, other)
      assert.equal((await view(flow, browser)).client, null)
      assert.equal((await decision(flow, 'approve', browser)).status, 400)
      const approved = await decision(flow, 'approve')
      assert.equal(approved.status, 303)
      const result = callback(approved)
      assert.equal(result.origin + result.pathname, redirect)
      assert.equal(result.searchParams.get('state'), 'fixture-csrf-state')
      const code = result.searchParams.get('code')
      const log = t.mock.method(console, 'warn', () => {})
      async function rejected(response, error, reason, status = 400) {
        assert.equal(response.status, status)
        assert.deepEqual(await response.json(), { error })
        const requestId = response.headers.get('x-request-id')
        assert.match(requestId, /^[a-f0-9-]{36}$/)
        const [event, fields] = log.mock.calls.at(-1).arguments
        assert.equal(event, 'kino.oauth.token_rejected')
        assert.deepEqual(
          { requestId, error, reason, status },
          {
            requestId: fields.requestId,
            error: fields.error,
            reason: fields.reason,
            status: fields.status,
          }
        )
        const output = JSON.stringify(fields)
        for (const sensitive of [code, proof, redirect, clientId, 'private-test-input'])
          assert.equal(output.includes(sensitive), false)
        return fields
      }
      const flags = await rejected(
        await exchange(code, 'private-test-input'),
        'invalid_request',
        'missing_or_malformed_code_verifier'
      )
      assert.equal(flags.validCodeVerifier, false)
      assert.deepEqual(flags.presence, {
        resource: true,
        clientId: true,
        codeVerifier: true,
        redirectUri: true,
        scope: false,
        code: true,
        refreshToken: false,
      })
      const formResponse = await oauth(
        new Request(origin + '/oauth/token', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: 'client_id=private-test-input&client_id=private-test-input',
        }),
        context('token')
      )
      await rejected(formResponse, 'invalid_request', 'duplicate_parameter')
      await rejected(
        await exchange(code, proof, { grant_type: 'private-test-input' }),
        'unsupported_grant_type',
        'unsupported_grant'
      )
      await rejected(
        await exchange(code, proof, { scope: 'private-test-input' }),
        'invalid_scope',
        'unsupported_scope'
      )
      await rejected(
        await exchange(code, proof, { scope: 'kino.read' }),
        'invalid_request',
        'scope_on_code_exchange'
      )
      await rejected(
        await exchange(code, randomBytes(50).toString('base64url')),
        'invalid_grant',
        'grant_rejected_by_database'
      )
      await rejected(
        await exchange(code, proof, { redirect_uri: redirect + 'x' }),
        'invalid_grant',
        'grant_rejected_by_database'
      )
      await rejected(
        await exchange(code, proof, { client_id: codexIdUrl }),
        'invalid_grant',
        'grant_rejected_by_database'
      )
      for (const incorrectResource of ['', origin + '/other'])
        await rejected(
          await exchange(code, proof, { resource: incorrectResource }),
          'invalid_target',
          'resource_mismatch'
        )
      const issued = await exchange(code, proof)
      assert.equal(issued.status, 200, await issued.clone().text())
      connection = await issued.json()
      assert.equal(connection.scope, 'kino.read kino.write')
      assert.ok(connection.expires_in <= 300)
      await rejected(await exchange(code, proof), 'invalid_grant', 'grant_rejected_by_database')
      assert.equal((await decision(flow, 'approve')).status, 400)
    }
  )

  await t.test(
    'discover nine tools in both MCP protocol generations and commit real writes',
    async () => {
      const token = connection.access_token
      const legacy = await requestMcp(token, 'initialize', {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'Fixture', version: '1' },
      })
      assert.equal(legacy.data.result.protocolVersion, '2025-11-25')
      const list = await requestMcp(token, 'tools/list', {}, true)
      assert.equal(list.response.status, 200, JSON.stringify(list.data))
      assert.equal(list.data.result.tools.length, 9)
      assert.equal(
        list.data.result.tools.find((tool) => tool.name === 'create_watchlist').annotations
          .readOnlyHint,
        false
      )
      const create = contents(
        await call(
          token,
          'create_watchlist',
          {
            name: 'OAuth test watchlist',
            visibility: 'private',
            idempotency_key: 'oauth-fixture-list',
          },
          true
        )
      )
      const id = create.list.id
      assert.equal(
        (await rows(db.from('watchlists').select('user_id').eq('id', id).single())).user_id,
        owner
      )
      const search = contents(await call(token, 'search_titles', { query: 'Interstellar' }))
      const receipt = contents(
        await call(token, 'add_to_watchlist', {
          title_id: search.best_match_id,
          list_id: id,
          idempotency_key: 'oauth-fixture-add',
        })
      )
      assert.equal(receipt.list.item_count, 1)
      assert.equal(
        (await rows(db.from('watchlist_items').select('added_by').eq('watchlist_id', id).single()))
          .added_by,
        owner
      )
      const bad = await call(token, 'create_watchlist', { user_id: other, name: 'No' })
      assert.ok(bad.data.error || bad.data.result?.isError)
      assert.ok(!JSON.stringify(bad.data).includes(token))
    }
  )

  await t.test('scopes, denial, expiry, and accounts remain isolated', async () => {
    const denied = await start('kino.read')
    assert.equal((await view(denied.flow)).client.scopes.join(' '), 'read')
    const rejected = callback(await decision(denied.flow, 'deny'))
    assert.equal(rejected.searchParams.get('error'), 'access_denied')
    assert.equal(rejected.searchParams.has('code'), false)
    const expired = await start('kino.read', { client_id: codexIdUrl, redirect_uri: codexRedirect })
    const expiring = callback(await decision(expired.flow, 'approve'))
    await rows(
      db
        .from('kino_ai_flows')
        .update({ code_expires_at: '2000-01-01T00:00:00Z' })
        .eq('id', expired.flow)
    )
    assert.deepEqual(
      await (await codexExchange(expiring.searchParams.get('code'), expired.proof)).json(),
      { error: 'invalid_grant' }
    )
    const readOnly = await approve('kino.read')
    const scope = await call(readOnly.access_token, 'create_watchlist', {})
    assert.equal(scope.response.status, 403)
    assert.match(scope.response.headers.get('www-authenticate'), /kino.write/)
    const writeOnly = await approve('kino.write')
    assert.equal((await call(writeOnly.access_token, 'get_diary', {})).response.status, 403)
    await rows(
      db
        .from('kino_agent_tokens')
        .update({ expires_at: '2000-01-01T00:00:00Z' })
        .eq('token_hash', digest(readOnly.access_token))
    )
    assert.equal((await call(readOnly.access_token, 'get_diary', {})).response.status, 401)
    await signIn(alternate, other)
    await post('settings', { enabled: 'true' }, alternate)
    const isolated = await start('kino.read')
    for (const [name, value] of cookies) if (name.startsWith('kino_ai_')) alternate.set(name, value)
    const granted = callback(await decision(isolated.flow, 'approve', alternate))
    const secondAccount = await (
      await exchange(granted.searchParams.get('code'), isolated.proof)
    ).json()
    const result = await call(secondAccount.access_token, 'find_watchlist', {
      name: 'OAuth test watchlist',
    })
    assert.equal(contents(result).error.code, 'list_not_found')
  })

  await t.test(
    'refresh rotates, replay revokes, and toggle off and on requires fresh authorization',
    async () => {
      const firstRefresh = await refresh(connection.refresh_token)
      assert.equal(firstRefresh.status, 200)
      const rotated = await firstRefresh.json()
      assert.notEqual(rotated.refresh_token, connection.refresh_token)
      assert.equal((await refresh(connection.refresh_token)).status, 400)
      assert.equal((await refresh(rotated.refresh_token)).status, 400)
      assert.equal((await call(rotated.access_token, 'get_diary', {})).response.status, 401)

      const codex = await start('kino.read', { client_id: codexIdUrl, redirect_uri: codexRedirect })
      const approved = await decision(codex.flow, 'approve')
      assert.equal(approved.status, 303)
      const target = callback(approved)
      assert.equal(target.origin + target.pathname, codexRedirect)
      const codexCode = target.searchParams.get('code')
      process.env.KINO_AGENT_ORIGIN = 'http://localhost:65500'
      try {
        const foreign = await codexExchange(codexCode, codex.proof)
        assert.deepEqual(await foreign.json(), { error: 'invalid_grant' })
      } finally {
        process.env.KINO_AGENT_ORIGIN = origin
      }
      const codexResponse = await codexExchange(codexCode, codex.proof)
      assert.equal(codexResponse.status, 200)
      const codexTokens = await codexResponse.json()
      assert.deepEqual(await (await codexExchange(codexCode, codex.proof)).json(), {
        error: 'invalid_grant',
      })
      assert.equal(
        await rows(
          db.rpc('kino_ai_access', {
            p_hash: digest(codexTokens.access_token),
            p_resource: origin + '/other',
          })
        ),
        null
      )
      const codexTools = await requestMcp(codexTokens.access_token, 'tools/list', {})
      assert.equal(codexTools.response.status, 200)
      assert.equal(codexTools.data.result.tools.length, 9)
      const codexRefresh = (token, override = {}) =>
        post('token', {
          grant_type: 'refresh_token',
          client_id: codexIdUrl,
          refresh_token: token,
          ...override,
        })
      assert.deepEqual(
        await (await codexRefresh(codexTokens.refresh_token, { scope: 'kino.write' })).json(),
        { error: 'invalid_scope' }
      )
      const codexRotated = await codexRefresh(codexTokens.refresh_token)
      assert.equal(codexRotated.status, 200)
      const renewed = await codexRotated.json()
      assert.notEqual(renewed.refresh_token, codexTokens.refresh_token)
      assert.equal((await requestMcp(renewed.access_token, 'tools/list', {})).response.status, 200)
      assert.deepEqual(await (await codexRefresh(codexTokens.refresh_token)).json(), {
        error: 'invalid_grant',
      })
      assert.equal((await requestMcp(renewed.access_token, 'tools/list', {})).response.status, 401)

      const explicit = await start('kino.read', {
        client_id: codexIdUrl,
        redirect_uri: codexRedirect,
      })
      const explicitCode = callback(await decision(explicit.flow, 'approve')).searchParams.get(
        'code'
      )
      assert.equal((await codexExchange(explicitCode, explicit.proof, { resource })).status, 200)

      const active = await approve()
      await post('settings', { enabled: 'false' })
      assert.equal((await call(active.access_token, 'get_diary', {})).response.status, 401)
      assert.equal((await refresh(active.refresh_token)).status, 400)
      assert.equal((await rows(db.from('watchlists').select('id').eq('user_id', owner))).length, 1)
      await post('settings', { enabled: 'true' })
      assert.equal((await call(active.access_token, 'get_diary', {})).response.status, 401)
      const fresh = await approve()
      assert.ok(contents(await call(fresh.access_token, 'get_diary', {})).entries)
      assert.equal(
        (await post('revoke', { token: fresh.refresh_token, client_id: clientId })).status,
        200
      )
      assert.equal((await call(fresh.access_token, 'get_diary', {})).response.status, 401)
    }
  )
})
