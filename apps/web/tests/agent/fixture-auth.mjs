import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const fixtureUsers = [
  {
    id: 'd0000000-0000-4000-8000-000000000000',
    email: 'owner@example.test',
    username: 'fixture_owner',
  },
  {
    id: 'e0000000-0000-4000-8000-000000000000',
    email: 'other@example.test',
    username: 'fixture_other',
  },
]

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function fixtureJwt(
  role,
  secret,
  sub,
  expires = sub ? Math.floor(Date.now() / 1000) + 3600 : undefined
) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const payload = encode({ typ: 'JWT', alg: 'HS256' }) + '.' + encode({ role, sub, exp: expires })
  return payload + '.' + signature(payload, secret)
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { username: user.username, display_name: user.username },
    created_at: '2025-01-01T00:00:00Z',
  }
}

function loggedInUser(request, secret) {
  const token = /^Bearer (.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1]
  if (!token) return null
  const [header, body, signaturePart, extra] = token.split('.')
  if (!header || !body || !signaturePart || extra !== undefined) return null
  const actual = Buffer.from(signaturePart)
  const expected = Buffer.from(signature(header + '.' + body, secret))
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (claims.role === 'authenticated' && claims.exp > Date.now() / 1000)
      return fixtureUsers.find((user) => user.id === claims.sub) ?? null
  } catch {
    return null
  }
  return null
}

export function createFixtureAuth(secret) {
  const password = randomBytes(18).toString('base64url')
  const refreshTokens = new Map()

  function session(user) {
    const refresh = randomBytes(32).toString('base64url')
    refreshTokens.set(refresh, user)
    return Response.json(
      {
        access_token: fixtureJwt('authenticated', secret, user.id),
        expires_in: 3600,
        refresh_token: refresh,
        token_type: 'bearer',
        user: publicUser(user),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  async function handle(request) {
    const url = new URL(request.url)
    if (url.pathname === '/auth/v1/token' && request.method === 'POST') {
      const body = await request.json().catch(() => null)
      const grant = url.searchParams.get('grant_type')
      if (grant === 'password') {
        const user =
          body?.password === password && fixtureUsers.find((item) => item.email === body.email)
        return user
          ? session(user)
          : Response.json(
              { code: 'invalid_credentials', message: 'Invalid fixture login' },
              { status: 400 }
            )
      }
      if (grant === 'refresh_token') {
        const user = refreshTokens.get(body?.refresh_token)
        refreshTokens.delete(body?.refresh_token)
        return user
          ? session(user)
          : Response.json(
              { code: 'refresh_token_not_found', message: 'Invalid fixture refresh token' },
              { status: 400 }
            )
      }
    }
    if (url.pathname === '/auth/v1/user' && request.method === 'GET') {
      const user = loggedInUser(request, secret)
      return user
        ? Response.json(publicUser(user))
        : Response.json({ code: 'bad_jwt', message: 'Invalid fixture session' }, { status: 401 })
    }
    if (url.pathname === '/auth/v1/logout' && request.method === 'POST') {
      const user = loggedInUser(request, secret)
      if (user)
        for (const [token, owner] of refreshTokens) if (owner === user) refreshTokens.delete(token)
      return new Response(null, { status: 204 })
    }
    return Response.json(
      { message: 'Fixture Auth supports password sign-in and session refresh.' },
      { status: 404 }
    )
  }
  return { handle, password }
}
