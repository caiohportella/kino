import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { clientDocuments } from '../client-documents.mjs'
import { fixtureUsers } from '../fixture-auth.mjs'

function verifyAuthorizationRequest(request, { profile, kinoOrigin, browserOrigin }) {
  const { searchParams } = new URL(request.url())
  const redirect =
    profile === 'codex' ? browserOrigin + '/callback' : clientDocuments.chatgpt.redirect_uris[0]
  assert.deepEqual(Object.fromEntries(searchParams), {
    response_type: 'code',
    client_id: clientDocuments[profile].client_id,
    redirect_uri: redirect,
    resource: kinoOrigin + '/mcp',
    scope: 'kino.read kino.write',
    state: searchParams.get('state'),
    code_challenge: searchParams.get('code_challenge'),
    code_challenge_method: 'S256',
  })
  assert.match(searchParams.get('state'), /^[A-Za-z0-9_-]{43}$/)
  assert.match(searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/)
  assert.equal(searchParams.size, 8)
}

async function signInAndApprove(page, user, fixturePassword) {
  await page.waitForURL(
    (url) => url.pathname === '/auth/login' && url.searchParams.has('ai_flow'),
    {
      waitUntil: 'domcontentloaded',
    }
  )
  await page.getByLabel('Email', { exact: true }).fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill(fixturePassword)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(
    (url) => url.pathname === '/auth/authorize' && url.searchParams.has('flow'),
    {
      waitUntil: 'domcontentloaded',
    }
  )
  await page.getByRole('heading', { name: 'Connect your Kino account' }).waitFor()
  await page.getByRole('heading', { name: 'View your Kino activity' }).waitFor()
  await page.getByRole('heading', { name: 'Make changes when you ask' }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Allow access' }).count(), 0)
  await page.getByRole('button', { name: 'Enable AI Integration' }).click()
  await page.getByRole('button', { name: 'Allow access' }).click()
  const result = page.getByRole('status').filter({ hasText: /Connected to Kino|Kino rejected/ })
  await result.waitFor()
  assert.equal(await result.textContent(), 'Connected to Kino')
}

async function action(page, name, expectedStatus = 200) {
  await page.getByRole('button', { name, exact: true }).click()
  await page
    .getByRole('status')
    .filter({ hasText: `MCP returned HTTP ${expectedStatus}` })
    .waitFor()
  return JSON.parse(await page.getByLabel('MCP result').textContent())
}

export async function runBrowserTests({
  kinoOrigin,
  browserOrigin,
  signal,
  verifyWatchlist,
  fixturePassword,
}) {
  const browser = await chromium.launch()
  signal.then(() => browser.close()).catch(() => undefined)
  try {
    const codex = await browser.newContext({ serviceWorkers: 'block' })
    const localOrigins = new Set([kinoOrigin, browserOrigin])
    await codex.route('**/*', (route) =>
      localOrigins.has(new URL(route.request().url()).origin) ? route.continue() : route.abort()
    )
    const page = await codex.newPage()
    page.setDefaultTimeout(60_000)
    const browserErrors = []
    page.on('pageerror', (error) => browserErrors.push(error.name + ': ' + error.message))
    try {
      await page.goto(browserOrigin)
      const request = page.waitForRequest((request) =>
        request.url().startsWith(kinoOrigin + '/oauth/authorize?')
      )
      const loginRedirect = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/auth/authorize' &&
          response.request().isNavigationRequest()
      )
      await page.getByRole('button', { name: 'Connect to Kino', exact: true }).click()
      verifyAuthorizationRequest(await request, {
        profile: 'codex',
        kinoOrigin,
        browserOrigin,
      })
      const redirect = await loginRedirect
      assert.equal(redirect.status(), 307)
      const login = new URL(await redirect.headerValue('location'), kinoOrigin)
      assert.equal(login.origin, kinoOrigin)
      assert.equal(login.pathname, '/auth/login')
      assert.ok(login.searchParams.has('ai_flow'))
      await signInAndApprove(page, fixtureUsers[0], fixturePassword)
      const tools = await action(page, 'List tools')
      assert.equal(tools.result.tools.length, 9)
      assert.ok(tools.result.tools.some((tool) => tool.name === 'create_watchlist'))

      const diary = await action(page, 'Read diary')
      assert.match(JSON.stringify(diary.result.structuredContent), /Arrival/)
      assert.doesNotMatch(JSON.stringify(diary.result.structuredContent), /Gattaca/)

      const seeded = await action(page, 'Find fixture watchlist')
      assert.equal(seeded.result.structuredContent.matches[0].name, 'Fixture Watchlist')

      const name = 'Browser fixture watchlist'
      await page.getByLabel('Watchlist name').fill(name)
      const watchlist = await action(page, 'Create private watchlist')
      const created = watchlist.result.structuredContent.list
      assert.equal(created.name, name)
      assert.equal(created.visibility, 'private')
      await verifyWatchlist(created.id, name, fixtureUsers[0].id)

      await page.getByRole('button', { name: 'Refresh authorization' }).click()
      await page
        .getByRole('status')
        .filter({ hasText: 'Kino rotated the refresh token.' })
        .waitFor()
      const afterRefresh = await action(page, 'List tools')
      assert.equal(afterRefresh.result.tools.length, 9)

      await page.goto(kinoOrigin + '/settings/integrations')
      const toggle = page.getByRole('switch', { name: 'Allow AI access' })
      assert.equal(await toggle.isChecked(), true)
      await toggle.click()
      await page.getByRole('status').filter({ hasText: 'Disabled' }).waitFor()
      await page.goto(browserOrigin)
      const revoked = await action(page, 'Check access', 401)
      assert.equal(revoked.error, 'invalid_token')
      await page.getByRole('button', { name: 'Refresh authorization' }).click()
      await page
        .getByRole('status')
        .filter({ hasText: 'Kino rejected token refresh (HTTP 400).' })
        .waitFor()
      console.log(
        'PASS Codex-shaped browser login, consent, MCP tools, persisted write, refresh rotation and immediate revocation.'
      )
    } catch (error) {
      const title = await page.title().catch(() => '')
      console.error('Browser fixture failed on', new URL(page.url()).pathname, title, browserErrors)
      throw error
    } finally {
      await codex.close()
    }

    const chatgpt = await browser.newContext({ serviceWorkers: 'block' })
    await chatgpt.route('**/*', (route) =>
      localOrigins.has(new URL(route.request().url()).origin) ? route.continue() : route.abort()
    )
    let hostedCallback
    await chatgpt.route(kinoOrigin + '/oauth/consent', async (route) => {
      if (new URLSearchParams(route.request().postData()).get('decision') !== 'approve')
        return route.continue()
      // Keep the registered callback in both OAuth requests. Capture Kino's redirect before
      // Chromium follows it, then deliver its response parameters to the loopback simulator.
      const response = await route.fetch({ maxRedirects: 0 })
      const headers = response.headers()
      if (response.status() !== 303 || !headers.location) return route.fulfill({ response })
      const callback = new URL(headers.location)
      hostedCallback = callback.origin + callback.pathname
      if (hostedCallback !== clientDocuments.chatgpt.redirect_uris[0]) return route.abort()
      return route.fulfill({
        response,
        headers: { ...headers, location: browserOrigin + '/callback' + callback.search },
      })
    })
    const chatgptPage = await chatgpt.newPage()
    chatgptPage.setDefaultTimeout(60_000)
    try {
      const start = await chatgpt.request.post(browserOrigin + '/connect?client=chatgpt', {
        headers: { Origin: browserOrigin },
        maxRedirects: 0,
      })
      assert.equal(start.status(), 303)
      const target = start.headers().location
      verifyAuthorizationRequest(
        { url: () => target },
        { profile: 'chatgpt', kinoOrigin, browserOrigin }
      )
      await chatgptPage.goto(target)
      await signInAndApprove(chatgptPage, fixtureUsers[1], fixturePassword)
      assert.equal(hostedCallback, clientDocuments.chatgpt.redirect_uris[0])
      const diary = await action(chatgptPage, 'Read diary')
      assert.match(JSON.stringify(diary.result.structuredContent), /Gattaca/)
      assert.doesNotMatch(JSON.stringify(diary.result.structuredContent), /Arrival/)
      console.log(
        'PASS ChatGPT-shaped hosted callback, token exchange and fixture-account isolation.'
      )
    } finally {
      await chatgpt.close()
    }
  } finally {
    await browser.close()
  }
}
