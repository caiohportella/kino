import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { POST } from '../../app/api/agent/v1/[operation]/route.ts'
import { digest, issueToken } from '../../lib/agent/server.ts'
import { catalogFixture } from './catalog-fixture.mjs'

const users = {
  account: 'a0000000-0000-4000-8000-000000000000',
  other: 'b0000000-0000-4000-8000-000000000000',
  rollback: 'c0000000-0000-4000-8000-000000000000',
}
const defaultList = 'a0000000-0000-4000-8000-000000000001'
const mustBinge = 'a0000000-0000-4000-8000-000000000002'
const python = process.env.PYTHON || 'python'
const adapter = fileURLToPath(
  new URL('../../../../marketplace/agensi/dev/kino.py', import.meta.url)
)

function jwt(role, sub, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ role, sub })).toString('base64url')
  const unsigned = `${header}.${payload}`
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`
}

async function data(query) {
  const result = await query
  assert.equal(result.error, null, result.error?.message)
  return result.data
}

function assertTitle(title, id, origin) {
  assert.equal(title.id, id)
  assert.equal(title.tmdb_id, Number(id.split(':')[1]))
  assert.equal(title.media_type, id.split(':')[0])
  assert.ok(title.title && 'original_title' in title)
  assert.ok(title.url.startsWith(origin + '/title/'))
  if (title.poster !== null) {
    assert.match(title.poster.w92, /^https:\/\/image\.tmdb\.org\/t\/p\/w92\//)
    assert.match(title.poster.w185, /^https:\/\/image\.tmdb\.org\/t\/p\/w185\//)
    assert.match(title.poster.w342, /^https:\/\/image\.tmdb\.org\/t\/p\/w342\//)
    assert.match(title.poster.w500, /^https:\/\/image\.tmdb\.org\/t\/p\/w500\//)
    assert.ok(title.poster.alt)
  }
}

test('Kino Agent API and shipped Python client against isolated PostgREST and PostgreSQL', async (t) => {
  const rest = new URL(process.env.KINO_AGENT_TEST_POSTGREST_URL)
  const secret = process.env.KINO_AGENT_TEST_JWT_SECRET
  assert.equal(rest.protocol, 'http:')
  assert.equal(rest.hostname, '127.0.0.1', 'the fixture must run on loopback')
  assert.ok(secret && secret.length >= 32)
  const service = jwt('service_role', undefined, secret)
  const anon = jwt('anon', undefined, secret)
  process.env.NEXT_PUBLIC_SUPABASE_URL = rest.origin
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anon
  process.env.SUPABASE_SERVICE_ROLE_KEY = service
  process.env.TMDB_API_KEY = 'local-fixture'
  process.env.NODE_ENV = 'development'
  const fetchOriginal = globalThis.fetch
  const fetchRest = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    assert.equal(url.origin, rest.origin)
    url.pathname = url.pathname.replace(/^\/rest\/v1/, '')
    return fetchOriginal(url, init)
  }
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    if (url.origin === 'https://api.themoviedb.org') return Promise.resolve(catalogFixture(url))
    if (url.origin === rest.origin) return fetchRest(input, init)
    if (url.hostname === 'localhost') return fetchOriginal(input, init)
    throw new Error('Unexpected fixture request')
  }
  t.after(() => {
    globalThis.fetch = fetchOriginal
  })

  const server = createServer(async (incoming, outgoing) => {
    const chunks = []
    for await (const chunk of incoming) chunks.push(chunk)
    const url = new URL(incoming.url, process.env.KINO_AGENT_ORIGIN)
    const result = await POST(
      new Request(url, {
        method: incoming.method,
        headers: incoming.headers,
        body: Buffer.concat(chunks),
      }),
      { params: Promise.resolve({ operation: url.pathname.split('/').at(-1) }) }
    )
    outgoing.writeHead(result.status, Object.fromEntries(result.headers))
    outgoing.end(Buffer.from(await result.arrayBuffer()))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())
  const origin = `http://localhost:${server.address().port}`
  process.env.KINO_AGENT_ORIGIN = origin

  const client = (key) =>
    createClient(rest.origin, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchRest },
    })
  const db = client(service)
  const publicDb = client(anon)
  const otherDb = client(jwt('authenticated', users.other, secret))
  const issue = async (user_id, fields = {}) => {
    const token = issueToken()
    await data(
      db.from('kino_agent_tokens').insert({
        name: 'Fixture connection',
        user_id,
        token_hash: digest(token),
        scopes: ['read', 'write'],
        language: 'pt',
        timezone: 'America/Sao_Paulo',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        ...fields,
      })
    )
    return token
  }
  const token = await issue(users.account, { default_list_id: defaultList })
  const other = await issue(users.other, { timezone: 'Pacific/Kiritimati' })
  const rollback = await issue(users.rollback)
  const readOnly = await issue(users.account, { scopes: ['read'] })
  const writeOnly = await issue(users.account, { scopes: ['write'] })
  const expired = await issue(users.other, { expires_at: '2000-01-01T00:00:00Z' })

  const api = async (operation, body, access = token, suffix = '') => {
    const result = await fetchOriginal(`${origin}/api/agent/v1/${operation}${suffix}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` },
      body: JSON.stringify(body),
    })
    assert.match(result.headers.get('cache-control'), /no-store/)
    return { status: result.status, headers: result.headers, payload: await result.json() }
  }
  const cli = async (operation, body, access = token) => {
    const child = spawn(python, ['-B', adapter, operation], {
      env: {
        ...process.env,
        KINO_AGENT_TOKEN: access,
        KINO_AGENT_ORIGIN: origin,
        KINO_AGENT_ALLOW_LOCAL_HTTP: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    child.stdin.end(JSON.stringify(body))
    const stdout = []
    const stderr = []
    child.stdout.on('data', (chunk) => stdout.push(chunk))
    child.stderr.on('data', (chunk) => stderr.push(chunk))
    const [exit] = await once(child, 'close')
    const output = Buffer.concat(stdout).toString()
    assert.equal(Buffer.concat(stderr).toString(), '')
    assert.ok(!output.includes(access))
    const receipt = JSON.parse(output)
    assert.equal(exit, 0, JSON.stringify(receipt))
    assert.deepEqual(receipt.meta.user, {
      locale: 'pt-BR',
      timezone: 'America/Sao_Paulo',
      region: 'BR',
    })
    assert.match(receipt.meta.today, /^\d{4}-\d\d-\d\d$/)
    assert.match(receipt.meta.request_id, /^[a-f\d-]{36}$/)
    assert.match(receipt.meta.attribution, /TMDB/)
    return receipt
  }

  await t.test(
    '1. Interstellar goes into the configured default, with a committed count',
    async () => {
      const search = await cli('search-titles', { query: 'Interstellar' })
      assert.equal(search.best_match_id, 'movie:157336')
      assertTitle(search.candidates[0], search.best_match_id, origin)
      const lists = await cli('find-watchlist', {})
      assert.equal(lists.matches[0].id, defaultList)
      const args = {
        list_id: defaultList,
        title_id: search.best_match_id,
        idempotency_key: 'interstellar',
      }
      const added = await cli('add-to-watchlist', args)
      assert.equal(added.status, 'added')
      assert.equal(added.list.item_count, 1)
      assert.equal(
        (await cli('add-to-watchlist', { ...args, idempotency_key: 'duplicate-item' })).status,
        'already_present'
      )
      assert.equal(
        (await data(db.from('watchlist_items').select('id').eq('watchlist_id', defaultList)))
          .length,
        1
      )
    }
  )

  await t.test(
    '2. Odyssey search presents the two works before the selected title is added',
    async () => {
      const search = await cli('search-titles', { query: 'The Odyssey', limit: 2 })
      assert.equal(search.ambiguous, true)
      assert.equal(search.best_match_id, null)
      assert.deepEqual(
        search.candidates.map((row) => row.id),
        ['movie:1001', 'tv:1002']
      )
      assert.equal(search.candidates[1].poster, null)
      const before = await data(
        db.from('watchlist_items').select('id').eq('watchlist_id', mustBinge)
      )
      assert.equal(before.length, 1)
      const list = (await cli('find-watchlist', { name: 'must binge' })).matches[0]
      const receipt = await cli('add-to-watchlist', {
        list_id: list.id,
        title_id: search.candidates[1].id,
        idempotency_key: 'odyssey',
      })
      assert.equal(receipt.title.media_type, 'tv')
      assert.equal(receipt.list.item_count, 2)
    }
  )

  await t.test(
    '3. Dune diary event and rating commit together, replay and rewatch preserve history',
    async () => {
      const title = (await cli('search-titles', { query: 'Dune: Part Two', year: 2024 }))
        .candidates[0]
      assert.equal(title.title, 'Duna: Parte Dois')
      assert.equal(title.original_title, 'Dune: Part Two')
      assert.match(title.url, /693134-dune-part-two/)
      const args = { title_id: title.id, rating: 4.5, watched_on: null, idempotency_key: 'dune' }
      const first = await cli('log-watch', args)
      assert.equal(first.entry.watched_on, first.meta.today)
      assert.equal(first.entry.date_defaulted, true)
      assert.equal(first.entry.rating, 4.5)
      assert.equal(first.entry.is_rewatch, false)
      assert.equal((await cli('log-watch', args)).entry.id, first.entry.id)
      assert.equal(
        (await api('log_watch', { ...args, rating: 5 })).payload.error.code,
        'idempotency_conflict'
      )
      assert.equal(
        (await api('log_watch', { ...args, rating: 4.6 })).payload.error.code,
        'invalid_rating'
      )
      const second = await cli('log-watch', {
        ...args,
        rating: null,
        idempotency_key: 'dune-rewatch',
      })
      assert.equal(second.entry.previous_entry.id, first.entry.id)
      assert.equal(second.entry.is_rewatch, true)
      assert.equal(
        (await data(db.from('watch_diary').select('id').eq('user_id', users.account))).length,
        2
      )
      const ratings = await data(
        db.from('title_ratings').select('rating').eq('user_id', users.account).eq('rating', 4.5)
      )
      assert.equal(ratings.length, 1)
    }
  )

  await t.test(
    '4. Private list persists and another viewer cannot read it or edit it',
    async () => {
      const args = {
        name: 'Sci-Fi Essentials',
        visibility: 'private',
        idempotency_key: 'private-list',
      }
      const { list } = await cli('create-watchlist', args)
      assert.equal(list.visibility, 'private')
      assert.equal((await cli('create-watchlist', args)).list.id, list.id)
      assert.deepEqual(await data(otherDb.from('watchlists').select('id').eq('id', list.id)), [])
      assert.equal(
        (
          await api(
            'add_to_watchlist',
            { list_id: list.id, title_id: 'movie:157336', idempotency_key: 'private-other' },
            other
          )
        ).status,
        404
      )
      assert.equal(
        (
          await api('create_watchlist', {
            ...args,
            visibility: 'public',
            idempotency_key: 'conflict-list',
          })
        ).payload.error.code,
        'name_conflict'
      )
    }
  )

  await t.test(
    '5. Public list retains punctuation and description and is visible under web RLS',
    async () => {
      const { list } = await cli('create-watchlist', {
        name: "New Year's Goals",
        description: 'living the life',
        visibility: 'public',
        idempotency_key: 'public-list',
      })
      assert.equal(list.url, `${origin}/watchlists/${list.id}-new-year-s-goals`)
      const rows = await data(
        publicDb.from('watchlists').select('name,description,visibility').eq('id', list.id)
      )
      assert.deepEqual(rows, [
        { name: "New Year's Goals", description: 'living the life', visibility: 'public' },
      ])
    }
  )

  await t.test(
    '6. Severance marks the first five eligible episodes while retaining an earlier watch and rating',
    async () => {
      const args = {
        series_id: 'tv:95396',
        selector: { type: 'first_n', n: 5, scope: 'series_order' },
        idempotency_key: 'severance',
      }
      const batch = await cli('mark-episodes', args)
      assert.deepEqual(
        batch.resolved_episodes.map((row) => row.episode),
        [2, 3, 4, 5]
      )
      assert.deepEqual(
        batch.skipped_already_watched.map((row) => row.episode),
        [1]
      )
      assert.equal(batch.rating_applied, null)
      assert.equal(batch.progress.watched, 5)
      assert.equal(batch.progress.total, 5)
      assert.equal(batch.progress.next_episode, null)
      assert.match(batch.resolved_episodes[0].still, /^https:\/\/image\.tmdb\.org\/t\/p\/w300\//)
      assert.equal(
        (await api('mark_episodes', { ...args, idempotency_key: 'same-range-again' })).payload.error
          .code,
        'nothing_to_mark'
      )
      const episodes = await data(
        db
          .from('episode_ratings')
          .select('episode_number,rating')
          .eq('title_id', 'a0000000-0000-4002-8000-000000000001')
          .order('episode_number')
      )
      assert.deepEqual(
        episodes.map(({ rating }) => rating),
        [3.5, null, null, null, null]
      )
    }
  )

  await t.test(
    '7. The Mentalist uses next gaps, applies 4 stars, and serializes concurrent next requests',
    async () => {
      const args = {
        series_id: 'tv:5920',
        selector: { type: 'next_unwatched', count: 1 },
        rating: 4,
        idempotency_key: 'mentalist',
      }
      const receipt = await cli('mark-episodes', args)
      assert.deepEqual(
        receipt.resolved_episodes.map(({ season, episode }) => [season, episode]),
        [[1, 2]]
      )
      assert.equal(receipt.rating_applied, 4)
      assert.equal(receipt.progress.next_episode.episode, 4)
      const [one, two] = await Promise.all(
        ['next-one', 'next-two'].map((key) =>
          api('mark_episodes', { ...args, idempotency_key: key })
        )
      )
      assert.equal(one.status, 200)
      assert.equal(two.status, 200)
      assert.deepEqual(
        [one, two].map(({ payload }) => payload.resolved_episodes[0].episode).sort(),
        [4, 5]
      )
      assert.equal((await cli('mark-episodes', args)).resolved_episodes[0].episode, 2)
    }
  )

  await t.test('8. Diary keysets contain no duplicates and groups stay intact', async () => {
    const entries = []
    let cursor = null
    let total
    do {
      const page = await cli('get-diary', { limit: 2, cursor })
      entries.push(...page.entries)
      total = page.total
      cursor = page.next_cursor
      if (cursor)
        assert.equal((await api('get_diary', { cursor, collapse_episodes: false })).status, 400)
      assert.ok(entries.length <= 20)
    } while (cursor)
    assert.equal(entries.length, total)
    assert.equal(new Set(entries.map(({ id }) => id)).size, total)
    const group = entries.find((entry) => entry.episodes?.count === 4)
    assertTitle(group.title, 'tv:95396', origin)
    assert.deepEqual(
      group.episodes.items.map(({ episode }) => episode),
      [2, 3, 4, 5]
    )
    assert.equal(group.episodes.from, 2)
    assert.ok(entries.some(({ title, rating }) => title.id === 'movie:693134' && rating === 4.5))
    const otherDiary = await api('get_diary', {}, other)
    assert.equal(otherDiary.payload.total, 1)
    assert.equal(otherDiary.payload.entries[0].title.id, 'movie:782')
    assert.ok((await cli('get-diary', { collapse_episodes: false })).total > total)
  })

  await t.test(
    '9. Recommendations use rated seeds and exclude this account’s watched titles',
    async () => {
      const history = await cli('get-taste-profile', {})
      assert.ok(history.counts.rated_titles >= 5)
      const recommendations = await cli('get-candidates', { media_type: 'movie' })
      assert.ok(recommendations.candidates.length >= 2)
      assert.ok(!recommendations.candidates.some(({ title }) => title.id === 'movie:693134'))
      const gattaca = recommendations.candidates.find(({ title }) => title.id === 'movie:782')
      assert.equal(gattaca.in_watchlist, true)
      assert.equal(gattaca.seed.rating, 5)
      assertTitle(gattaca.seed.title, 'movie:329865', origin)
      assert.equal(
        (await api('get_candidates', {}, other)).payload.error.code,
        'insufficient_history'
      )
    }
  )

  await t.test(
    'auth and roles protect the API, private lists, and protected database functions',
    async () => {
      assert.equal((await api('get_diary', {}, '')).status, 401)
      assert.equal((await api('get_diary', {}, expired)).status, 401)
      assert.equal((await api('get_diary', {}, issueToken())).status, 401)
      assert.equal((await api('get_diary', {}, token, '?secret=fixture')).status, 400)
      assert.equal((await api('get_diary', { user_id: users.other })).status, 400)
      assert.equal((await api('get_diary', {}, writeOnly)).status, 403)
      assert.equal((await api('create_watchlist', {}, readOnly)).status, 403)
      assert.equal(
        (await api('find_watchlist', {}, other)).payload.error.code,
        'default_list_required'
      )
      assert.ok(
        (await api('find_watchlist', { name: 'Must Bing' })).payload.error.candidates.length
      )
      assert.ok((await otherDb.rpc('kino_agent_lists', { p_user: users.account })).error)
      assert.ok((await otherDb.from('kino_agent_tokens').select('token_hash')).error)
      const denied = await api('add_to_watchlist', {
        list_id: 'b0000000-0000-4000-8000-000000000002',
        title_id: 'movie:157336',
        idempotency_key: 'not-editor',
      })
      assert.equal(denied.status, 403)
      const shared = await cli('add-to-watchlist', {
        list_id: 'b0000000-0000-4000-8000-000000000003',
        title_id: 'movie:157336',
        idempotency_key: 'collaboration',
      })
      assert.equal(shared.status, 'added')
      await data(
        db
          .from('kino_agent_tokens')
          .update({ revoked_at: new Date().toISOString() })
          .eq('token_hash', digest(readOnly))
      )
      assert.equal((await api('get_diary', {}, readOnly)).status, 401)
    }
  )

  await t.test('failed batch rolls back and returns a safe error', async () => {
    const result = await api(
      'mark_episodes',
      {
        series_id: 'tv:95396',
        selector: { type: 'season', season: 1 },
        idempotency_key: 'rollback',
      },
      rollback
    )
    assert.equal(result.status, 503)
    assert.equal(result.payload.error.code, 'temporary_unavailable')
    assert.ok(!JSON.stringify(result.payload).includes('rollback fixture'))
    assert.deepEqual(
      await data(db.from('episode_ratings').select('id').eq('user_id', users.rollback)),
      []
    )
  })

  await t.test(
    'date metadata derives from the credential settings and limits give Retry-After',
    async () => {
      const auth = await api('get_diary', {}, other)
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Pacific/Kiritimati',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date())
      assert.equal(auth.payload.meta.today, today)
      const calls = await Promise.all(
        Array.from({ length: 65 }, () => api('get_taste_profile', {}, other))
      )
      const limited = calls.find(({ status }) => status === 429)
      assert.ok(limited)
      assert.equal(Number(limited.headers.get('retry-after')), limited.payload.error.retry_after)
      assert.ok(limited.payload.error.retry_after >= 1 && limited.payload.error.retry_after <= 60)
    }
  )
})
