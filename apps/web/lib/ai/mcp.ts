import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { AgentError, type Operation, readJson } from '@/lib/agent/contract'
import { isWrite, runAgentOperation } from '@/lib/agent/operations'
import { agentDb, agentOrigin, agentRpc, digest } from '@/lib/agent/server'
import { metadataUrl, resource } from './oauth'

const date = z.iso.date().nullish()
const media = z.enum(['movie', 'tv']).nullish()
const title = z.string().regex(/^(movie|tv):[1-9][0-9]{0,9}$/)
const key = z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/)
const rating = z.number().min(0.5).max(5).multipleOf(0.5).nullish()
const positive = z.int().min(1)
const operations = {
  search_titles: [
    'Resolve a movie or series. Present all plausible matches and obtain a selection before a write.',
    z.strictObject({
      query: z.string().min(1).max(160),
      media_type: media,
      year: z.int().min(1870).max(2199).nullish(),
      limit: positive.max(15).nullish(),
    }),
  ],
  find_watchlist: [
    'Resolve an existing watchlist by name or retrieve the default with an empty object.',
    z.strictObject({
      name: z.string().min(1).max(120).nullish(),
    }),
  ],
  add_to_watchlist: [
    'Add the resolved title to the resolved watchlist. Keep the same idempotency key on retry.',
    z.strictObject({
      list_id: z.uuid(),
      title_id: title,
      idempotency_key: key,
    }),
  ],
  create_watchlist: [
    'Create an explicitly requested watchlist. Keep the same idempotency key on retry.',
    z.strictObject({
      name: z.string().min(1).max(120),
      visibility: z.enum(['private', 'public']),
      description: z.string().max(1000).nullish(),
      idempotency_key: key,
    }),
  ],
  log_watch: [
    'Log a viewing and optional movie rating. Omit the date to use the account’s local day.',
    z.strictObject({
      title_id: title,
      rating,
      watched_on: date,
      rewatch: z.boolean().optional(),
      idempotency_key: key,
    }),
  ],
  mark_episodes: [
    'Mark released episodes using a server-resolved selector. Preserve existing episode watches and ratings.',
    z.strictObject({
      series_id: z.string().regex(/^tv:[1-9][0-9]{0,9}$/),
      rating,
      watched_on: date,
      idempotency_key: key,
      selector: z.discriminatedUnion('type', [
        z.strictObject({
          type: z.literal('first_n'),
          n: positive.max(100),
          scope: z.literal('series_order'),
        }),
        z.strictObject({ type: z.literal('next_unwatched'), count: positive.max(100).nullish() }),
        z.strictObject({
          type: z.literal('range'),
          season: z.int().min(0).max(10000),
          from: positive.max(10000),
          to: positive.max(10000),
        }),
        z.strictObject({ type: z.literal('season'), season: z.int().min(0).max(10000) }),
      ]),
    }),
  ],
  get_diary: [
    'Read the viewer’s diary in stable pages. Reuse the original filters when following a cursor.',
    z.strictObject({
      limit: positive.max(30).nullish(),
      cursor: z.string().max(400).nullish(),
      since: date,
      until: date,
      order: z.literal('watched_on_desc').nullish(),
      collapse_episodes: z.boolean().optional(),
    }),
  ],
  get_taste_profile: [
    'Summarize the viewer’s real ratings and viewing history.',
    z.strictObject({}),
  ],
  get_candidates: [
    'Find unwatched candidates with evidence from this viewer’s rated history.',
    z.strictObject({
      media_type: media,
      limit: positive.max(15).nullish(),
      seed_count: positive.max(10).nullish(),
    }),
  ],
} satisfies Record<Operation, [string, z.ZodType]>

function challenge(status: 401 | 403, scope?: string) {
  const error = status === 403 ? 'insufficient_scope' : 'invalid_token'
  const fields = [`resource_metadata="${metadataUrl()}"`, `error="${error}"`]
  if (scope) fields.push(`scope="${scope}"`)
  return Response.json(
    { error },
    {
      status,
      headers: {
        'WWW-Authenticate': `Bearer ${fields.join(', ')}`,
        'Cache-Control': 'no-store',
      },
    }
  )
}

function invokingTool(body: unknown) {
  if (
    !body ||
    typeof body !== 'object' ||
    !('method' in body) ||
    body.method !== 'tools/call' ||
    !('params' in body) ||
    !body.params ||
    typeof body.params !== 'object' ||
    !('name' in body.params)
  )
    return null
  const name = body.params.name
  return typeof name === 'string' && Object.hasOwn(operations, name) ? (name as Operation) : null
}

export async function handleMcp(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && ![agentOrigin(), 'https://chatgpt.com', 'https://claude.ai'].includes(origin))
    return new Response(null, { status: 403 })
  if (new URL(request.url).search) return new Response(null, { status: 400 })
  const match = /^Bearer (kino_mcp_[A-Za-z0-9_-]{43})$/i.exec(
    request.headers.get('authorization') ?? ''
  )
  if (!match) return challenge(401)

  try {
    const hash = digest(match[1]!)
    const scopes = await agentRpc<string[] | null>(agentDb(), 'kino_ai_access', {
      p_hash: hash,
      p_resource: resource(),
    })
    if (!scopes) return challenge(401)
    if (request.method !== 'POST')
      return new Response(null, {
        status: 405,
        headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
      })
    const body = await readJson(request)
    const tool = invokingTool(body)
    if (tool) {
      const scope = isWrite(tool) ? 'write' : 'read'
      if (!scopes.includes(scope)) return challenge(403, `kino.${scope}`)
    }

    const handler = createMcpHandler(
      () => {
        const server = new McpServer({ name: 'Kino', version: '3.0.0' })
        for (const name of Object.keys(operations) as Operation[]) {
          const [description, inputSchema] = operations[name]
          server.registerTool(
            name,
            {
              description,
              inputSchema,
              annotations: {
                readOnlyHint: !isWrite(name),
                destructiveHint: name === 'log_watch',
                idempotentHint: true,
                openWorldHint: true,
              },
            },
            async (input: unknown) => {
              const result = await runAgentOperation(
                name,
                () => hash,
                async () => input
              )
              const payload = await result.json()
              return {
                isError: !result.ok,
                structuredContent: payload,
                content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
              }
            }
          )
        }
        return server
      },
      { legacy: 'stateless' }
    )
    const response = await handler.fetch(request, { parsedBody: body })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    return Response.json(
      { error: error instanceof AgentError ? 'invalid_request' : 'temporarily_unavailable' },
      {
        status: error instanceof AgentError ? 400 : 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  }
}
