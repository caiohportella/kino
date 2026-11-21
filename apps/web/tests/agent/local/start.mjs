import { createHash, randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { cp, rename, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { basename, isAbsolute, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { catalogFixture } from '../catalog-fixture.mjs'
import { clientDocuments } from '../client-documents.mjs'
import { createFixtureAuth, fixtureJwt, fixtureUsers } from '../fixture-auth.mjs'
import { oauthSimulator } from './oauth-simulator.mjs'

const repo = fileURLToPath(new URL('../../../../../', import.meta.url))
const sourceWeb = join(repo, 'apps', 'web')
const rest = new URL(process.env.KINO_AGENT_TEST_POSTGREST_URL ?? '')
const secret = process.env.KINO_AGENT_TEST_JWT_SECRET
const scratch = process.argv[2]
if (
  rest.protocol !== 'http:' ||
  rest.hostname !== '127.0.0.1' ||
  !rest.port ||
  !secret ||
  secret.length < 32 ||
  !scratch ||
  !isAbsolute(scratch)
)
  throw new Error('Start the browser fixture through run-isolated.ps1.')

const browserTests = process.argv.includes('--browser')
const liveCodexMetadata = process.argv.includes('--codex-metadata')
const fixtureAuth = createFixtureAuth(secret)
const webPort = 3000
const nativeFetch = globalThis.fetch
const servers = []
let next
let stop
const stopped = new Promise((resolve) => {
  stop = resolve
})
process.once('SIGINT', stop)
process.once('SIGTERM', stop)

async function listen(handler, port = 0) {
  const server = createServer(handler)
  servers.push(server)
  server.listen(port, '127.0.0.1')
  try {
    await once(server, 'listening')
  } catch (error) {
    if (port && error.code === 'EADDRINUSE')
      throw new Error(
        `Local port ${port} is in use. Stop the process using it and rerun the fixture.`
      )
    throw error
  }
  return server
}

async function checkCodexAuthorization(kinoOrigin, fetchLocal) {
  const url = new URL('/oauth/authorize', kinoOrigin)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientDocuments.codex.client_id,
    redirect_uri: 'http://127.0.0.1:63457/callback',
    resource: kinoOrigin + '/mcp',
    scope: 'kino.read kino.write',
    state: randomBytes(32).toString('base64url'),
    code_challenge: createHash('sha256')
      .update(randomBytes(32).toString('base64url'))
      .digest('base64url'),
    code_challenge_method: 'S256',
  })
  const response = await fetchLocal(url, { signal: AbortSignal.timeout(60_000) })
  const location = new URL(response.headers.get('location') ?? '', kinoOrigin)
  if (
    response.status !== 303 ||
    location.origin !== kinoOrigin ||
    location.pathname !== '/auth/authorize' ||
    !location.searchParams.has('flow')
  ) {
    const payload = await response.json().catch(() => null)
    const error = ['invalid_request', 'temporarily_unavailable'].includes(payload?.error)
      ? ` ${payload.error}`
      : ''
    throw new Error(`Expected Kino consent HTTP 303, got HTTP ${response.status}${error}.`)
  }
  console.log(
    `PASS Codex stable client ID and loopback port 63457 returned HTTP 303 using ${liveCodexMetadata ? 'live' : 'fixture'} metadata.`
  )
}

async function readRequest(request, url) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 262144) throw new Error('Request too large for the local fixture.')
    chunks.push(chunk)
  }
  return new Request(url, {
    method: request.method,
    headers: request.headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : Buffer.concat(chunks),
  })
}

async function send(outgoing, response, extra = {}) {
  const body = await response.arrayBuffer()
  const headers = Object.fromEntries(response.headers)
  // fetch() gives us the decompressed bytes.
  delete headers['content-encoding']
  delete headers['content-length']
  delete headers['transfer-encoding']
  outgoing.writeHead(response.status, { ...headers, ...extra })
  outgoing.end(Buffer.from(body))
}

async function nextWorkspace() {
  const web = join(scratch, 'apps', 'web')
  // Stage app source without dotenv files. Next's generated files stay in this temporary copy.
  await cp(sourceWeb, web, {
    recursive: true,
    filter: (path) =>
      !/^(?:\.env(?:\.|$)|\.next(?:-|$)|\.vercel$|node_modules$|tsconfig\.tsbuildinfo$)/.test(
        basename(path)
      ),
  })
  await Promise.all([
    cp(join(repo, 'pnpm-workspace.yaml'), join(scratch, 'pnpm-workspace.yaml')),
    symlink(join(repo, 'packages'), join(scratch, 'packages'), 'junction'),
    symlink(join(repo, 'locales'), join(scratch, 'locales'), 'junction'),
    symlink(join(repo, 'node_modules'), join(scratch, 'node_modules'), 'junction'),
    symlink(join(sourceWeb, 'node_modules'), join(web, 'node_modules'), 'junction'),
  ])
  // Next's default dev request logs include OAuth query parameters.
  await rename(join(web, 'next.config.ts'), join(web, 'next.fixture-base.ts'))
  await writeFile(
    join(web, 'next.config.ts'),
    `
import kinoConfig from './next.fixture-base'
export default function config(phase: string) {
  return { ...kinoConfig(phase), logging: { incomingRequests: false } }
}
`
  )
  return web
}

try {
  let nextHandler
  await listen((req, res) => {
    if (!nextHandler) {
      res.writeHead(503).end()
      return
    }
    nextHandler(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500)
      res.end()
    })
  }, webPort)
  const kinoOrigin = `http://localhost:${webPort}`
  const localOrigins = new Set([kinoOrigin, `http://127.0.0.1:${webPort}`, rest.origin])
  async function fetchLocal(input, init = {}) {
    const url = new URL(input instanceof Request ? input.url : input)
    if (!localOrigins.has(url.origin))
      throw new Error('Fixture server fetch must stay on loopback.')
    return nativeFetch(input, { ...init, redirect: 'manual' })
  }

  const gateway = await listen(async (incoming, outgoing) => {
    const headers = {
      'Access-Control-Allow-Origin': kinoOrigin,
      'Access-Control-Allow-Headers':
        'authorization, apikey, content-type, x-client-info, x-supabase-api-version, prefer, range, range-unit, accept-profile, content-profile',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Expose-Headers': 'content-range, range-unit',
      Vary: 'Origin',
    }
    try {
      const url = new URL(incoming.url, browserOrigin)
      const origin = incoming.headers.origin
      if (origin && origin !== kinoOrigin && origin !== browserOrigin) {
        outgoing.writeHead(403).end()
        return
      }
      const request = await readRequest(incoming, url)
      if (url.pathname.startsWith('/auth/v1/') || url.pathname.startsWith('/rest/v1/')) {
        if (request.method === 'OPTIONS') {
          outgoing.writeHead(204, headers).end()
          return
        }
        if (url.pathname.startsWith('/auth/v1/')) {
          await send(outgoing, await fixtureAuth.handle(request), headers)
          return
        }
        const target = new URL(rest)
        target.pathname = url.pathname.slice('/rest/v1'.length)
        target.search = url.search
        const restHeaders = new Headers(request.headers)
        for (const header of ['host', 'connection', 'content-length', 'accept-encoding', 'origin'])
          restHeaders.delete(header)
        await send(
          outgoing,
          await fetchLocal(target, {
            method: request.method,
            headers: restHeaders,
            body: request.body ? await request.arrayBuffer() : undefined,
          }),
          headers
        )
        return
      }
      await send(outgoing, await simulator(request, url))
    } catch {
      if (!outgoing.headersSent) outgoing.writeHead(500, { 'Content-Type': 'text/plain' })
      outgoing.end('Local fixture request failed.')
    }
  })
  const browserOrigin = `http://127.0.0.1:${gateway.address().port}`
  localOrigins.add(browserOrigin)
  const simulator = oauthSimulator({
    kinoOrigin,
    browserOrigin,
    allowHostedCallback: browserTests,
    fetchLocal,
  })

  // Next sees only the fixture's Supabase configuration, even when this shell has cloud credentials.
  for (const key of Object.keys(process.env)) {
    if (
      /^(?:NEXT_PUBLIC_|EXPO_PUBLIC_|.*(?:SUPABASE|UPSTASH|TMDB|VERCEL|TOLGEE)_|ANALYZE$)/.test(key)
    )
      delete process.env[key]
  }
  Object.assign(process.env, {
    NODE_ENV: 'development',
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SUPABASE_URL: browserOrigin,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: fixtureJwt('anon', secret),
    SUPABASE_SERVICE_ROLE_KEY: fixtureJwt('service_role', secret),
    NEXT_PUBLIC_TMDB_API_KEY: 'local-fixture',
    TMDB_API_KEY: 'local-fixture',
    KINO_AGENT_ORIGIN: kinoOrigin,
    NEXT_PUBLIC_SITE_URL: kinoOrigin,
    NEXT_PUBLIC_AUTH_REDIRECT_URL: kinoOrigin + '/auth/callback',
  })
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    if (liveCodexMetadata && url.href === clientDocuments.codex.client_id) {
      return nativeFetch(url, { redirect: 'error', signal: AbortSignal.timeout(5000) }).then(
        (response) => {
          console.log(`Public Codex metadata returned HTTP ${response.status}.`)
          return response
        },
        (error) => {
          const code = error.cause?.code
          if (typeof code === 'string' && /^[A-Z0-9_]{1,48}$/.test(code))
            console.error(`Public Codex metadata fetch failed (${code}).`)
          else console.error('Public Codex metadata fetch failed.')
          throw error
        }
      )
    }
    const doc = Object.values(clientDocuments).find((item) => item.client_id === url.href)
    if (doc) return Promise.resolve(Response.json(doc))
    if (url.origin === 'https://api.themoviedb.org') return Promise.resolve(catalogFixture(url))
    if (localOrigins.has(url.origin)) return fetchLocal(input, init)
    return Promise.resolve(new Response(null, { status: 503 }))
  }

  const web = await nextWorkspace()
  process.chdir(web)
  const { default: createNext } = await import('next')
  next = createNext({
    dev: true,
    dir: web,
    hostname: 'localhost',
    port: webPort,
    customServer: true,
  })
  await next.prepare()
  nextHandler = next.getRequestHandler()
  console.log(`Kino web: ${kinoOrigin}`)
  console.log(`Kino MCP: ${kinoOrigin}/mcp`)
  if (browserTests || liveCodexMetadata) await checkCodexAuthorization(kinoOrigin, fetchLocal)
  if (browserTests) {
    const { runBrowserTests } = await import('./browser-tests.mjs')
    await runBrowserTests({
      kinoOrigin,
      browserOrigin,
      fixturePassword: fixtureAuth.password,
      signal: stopped,
      async verifyWatchlist(id, name, userId) {
        const url = new URL('/watchlists', rest)
        url.search = new URLSearchParams({
          id: 'eq.' + id,
          user_id: 'eq.' + userId,
          select: 'name,visibility',
        })
        const response = await fetchLocal(url, {
          headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
        })
        const rows = await response.json()
        if (
          !response.ok ||
          rows.length !== 1 ||
          rows[0].name !== name ||
          rows[0].visibility !== 'private'
        )
          throw new Error('The watchlist is missing from the fixture database.')
      },
    })
  } else if (!liveCodexMetadata) {
    console.log(`OAuth simulator: ${browserOrigin}`)
    console.log(`Fixture accounts: ${fixtureUsers.map((user) => user.email).join(' or ')}`)
    console.log(`Password for this run: ${fixtureAuth.password}`)
    console.log(
      `Codex desktop: Settings > MCP servers > Add server > Streamable HTTP > ${kinoOrigin}/mcp`
    )
    console.log('Save, select Restart, then Authenticate. Sign in with a fixture account.')
    console.log('Press Ctrl+C here to stop the fixture.')
    await stopped
  }
} catch (error) {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  console.error(message.replace(/\?[^\s"'<>]+/g, '?[redacted]'))
  process.exitCode = 1
} finally {
  for (const server of servers) {
    server.close()
    server.closeAllConnections()
  }
  if (next) await Promise.race([next.close(), delay(5000, undefined, { ref: false })])
  globalThis.fetch = nativeFetch
}
process.exit(process.exitCode ?? 0)
