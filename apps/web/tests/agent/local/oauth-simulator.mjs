import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { clientDocuments } from '../client-documents.mjs'

function html(value) {
  return String(value).replace(
    /[&<>"']/g,
    (ch) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[ch]
  )
}

function render(connected, message = '', result = '') {
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"><title>Kino OAuth fixture</title>
    <style>
      body{font:1rem/1.55 system-ui;max-width:46rem;margin:3rem auto;padding:0 1rem}
      form{margin:1rem 0} button,input{font:inherit;padding:.4rem .65rem}
      pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eee;color:#111;padding:1rem}
    </style>
    <h1>Kino OAuth fixture</h1>
    <p role="status">${html(message || (connected ? 'Connected to Kino' : 'Ready to connect'))}</p>
    ${
      connected
        ? `<form method="post" action="/tools"><button>List tools</button></form>
      <form method="post" action="/diary"><button>Read diary</button></form>
      <form method="post" action="/seeded-watchlist"><button>Find fixture watchlist</button></form>
      <form method="post" action="/watchlist">
        <label>Watchlist name <input name="name" value="Local OAuth smoke test" maxlength="120" required></label>
        <button>Create private watchlist</button>
      </form>
      <form method="post" action="/check"><button>Check access</button></form>
      <form method="post" action="/refresh"><button>Refresh authorization</button></form>
      <form method="post" action="/connect"><button>Reconnect to Kino</button></form>`
        : `<form method="post" action="/connect"><button>Connect to Kino</button></form>
      <p>Use a fixture account printed in the launch terminal.</p>`
    }
    ${result ? `<pre aria-label="MCP result">${html(result)}</pre>` : ''}</html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'same-origin',
      },
    }
  )
}

function moved(location, headers) {
  return new Response(null, {
    status: 303,
    headers: {
      ...headers,
      Location: location,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  })
}

export function oauthSimulator({ kinoOrigin, browserOrigin, allowHostedCallback, fetchLocal }) {
  const resource = kinoOrigin + '/mcp'
  const pending = new Map()
  const sessions = new Map()

  async function discover() {
    const challenge = await fetchLocal(resource)
    const metadataLocation = /resource_metadata="([^"]+)"/.exec(
      challenge.headers.get('www-authenticate') ?? ''
    )?.[1]
    if (challenge.status !== 401 || !metadataLocation)
      throw new Error('Kino did not advertise OAuth.')
    const protectedResource = await (await fetchLocal(metadataLocation)).json()
    if (
      protectedResource.resource !== resource ||
      protectedResource.authorization_servers?.[0] !== kinoOrigin
    )
      throw new Error('Unexpected resource or issuer.')
    const issuer = await (
      await fetchLocal(kinoOrigin + '/.well-known/oauth-authorization-server')
    ).json()
    if (
      issuer.issuer !== kinoOrigin ||
      new URL(issuer.authorization_endpoint).origin !== kinoOrigin ||
      new URL(issuer.token_endpoint).origin !== kinoOrigin ||
      issuer.client_id_metadata_document_supported !== true ||
      issuer.authorization_response_iss_parameter_supported !== true ||
      !issuer.token_endpoint_auth_methods_supported?.includes('none') ||
      !issuer.code_challenge_methods_supported?.includes('S256')
    )
      throw new Error('Unexpected Kino authorization metadata.')
    return issuer
  }

  async function begin(profile) {
    const client = clientDocuments[profile]
    const issuer = await discover()
    const redirect = profile === 'codex' ? browserOrigin + '/callback' : client.redirect_uris[0]
    const state = randomBytes(32).toString('base64url')
    const verifier = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const scopes = 'kino.read kino.write'
    const url = new URL(issuer.authorization_endpoint)
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: redirect,
      resource,
      scope: scopes,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })
    const expiresAt = Date.now() + 900_000
    for (const [key, attempt] of pending) if (attempt.expiresAt < Date.now()) pending.delete(key)
    pending.set(state, { issuer, client, verifier, redirect, expiresAt })
    return moved(url.toString())
  }

  async function complete(url) {
    const state = url.searchParams.get('state')
    const attempt = pending.get(state)
    pending.delete(state)
    if (!attempt || attempt.expiresAt < Date.now() || url.searchParams.get('iss') !== kinoOrigin)
      return render(false, 'Callback state or issuer rejected.')
    const code = url.searchParams.get('code')
    if (!code) return render(false, 'Kino authorization was cancelled or failed.')
    const token = await fetchLocal(attempt.issuer.token_endpoint, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: attempt.client.client_id,
        code,
        code_verifier: attempt.verifier,
        redirect_uri: attempt.redirect,
        ...(attempt.client === clientDocuments.codex ? {} : { resource }),
      }),
    })
    if (!token.ok) return render(false, 'Kino rejected the authorization code.')
    const tokens = await token.json()
    const session = randomBytes(32).toString('base64url')
    sessions.set(session, { issuer: attempt.issuer, client: attempt.client, tokens })
    return moved(browserOrigin + '/', {
      'Set-Cookie': `fixture_mcp=${session}; Path=/; HttpOnly; SameSite=Lax`,
    })
  }

  async function refresh(session) {
    const response = await fetchLocal(session.issuer.token_endpoint, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: session.client.client_id,
        refresh_token: session.tokens.refresh_token,
        ...(session.client === clientDocuments.codex ? {} : { resource }),
      }),
    })
    if (!response.ok) return render(true, `Kino rejected token refresh (HTTP ${response.status}).`)
    const rotated = await response.json()
    if (!rotated.refresh_token || rotated.refresh_token === session.tokens.refresh_token)
      return render(true, 'Kino did not rotate the refresh token.')
    session.tokens = rotated
    return render(true, 'Kino rotated the refresh token.')
  }

  async function call(accessToken, method, params) {
    const response = await fetchLocal(resource, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2025-11-25',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    const body = await response.text()
    const json = response.headers.get('content-type')?.includes('text/event-stream')
      ? body
          .split(/\r?\n/)
          .find((line) => line.startsWith('data: '))
          ?.slice(6)
      : body
    return render(
      true,
      `MCP returned HTTP ${response.status}`,
      json ? JSON.stringify(JSON.parse(json), null, 2) : ''
    )
  }

  return async (request, url) => {
    const sessionId = /(?:^|;\s*)fixture_mcp=([A-Za-z0-9_-]{43})(?:;|$)/.exec(
      request.headers.get('cookie') ?? ''
    )?.[1]
    const session = sessions.get(sessionId)
    if (request.method === 'GET' && url.pathname === '/') return render(Boolean(session))
    if (request.method === 'GET' && url.pathname === '/callback') return complete(url)
    if (request.method !== 'POST' || request.headers.get('origin') !== browserOrigin)
      return new Response(null, { status: 403 })
    if (url.pathname === '/connect') {
      const profile = url.searchParams.get('client') ?? 'codex'
      if (profile !== 'codex' && !(allowHostedCallback && profile === 'chatgpt'))
        return new Response(null, { status: 400 })
      return begin(profile)
    }
    if (!session) return render(false, 'Connect to Kino first.')
    if (url.pathname === '/refresh') return refresh(session)
    const access = session.tokens.access_token
    if (url.pathname === '/tools' || url.pathname === '/check')
      return call(access, 'tools/list', {})
    if (url.pathname === '/diary')
      return call(access, 'tools/call', { name: 'get_diary', arguments: {} })
    if (url.pathname === '/seeded-watchlist')
      return call(access, 'tools/call', {
        name: 'find_watchlist',
        arguments: { name: 'Fixture Watchlist' },
      })
    if (url.pathname === '/watchlist') {
      const name = new URLSearchParams(await request.text()).get('name')
      return call(access, 'tools/call', {
        name: 'create_watchlist',
        arguments: {
          name,
          visibility: 'private',
          idempotency_key: randomUUID(),
        },
      })
    }
    return new Response(null, { status: 404 })
  }
}
