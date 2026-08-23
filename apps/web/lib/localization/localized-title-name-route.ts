import {
  type LocalizedTitleNameBatchInput,
  type LocalizedTitleNameBatchResponse,
  normalizeLocalizedTitleNameBatchRequest,
} from '@kino/core/localization'

const RESPONSE_CACHE_CONTROL = 'private, max-age=300, stale-while-revalidate=86400'

interface LocalizedTitleNameResolver {
  resolve(
    input: LocalizedTitleNameBatchInput,
    signal?: AbortSignal
  ): Promise<LocalizedTitleNameBatchResponse>
}

export function createLocalizedTitleNameRouteHandler(resolver: LocalizedTitleNameResolver) {
  return async function handle(request: Request) {
    const input = await readInput(request)

    if (!input || input.items.length === 0) {
      return json(
        {
          error: 'Invalid localized title name batch.',
        },
        400
      )
    }

    try {
      const response = await resolver.resolve(input, request.signal)

      return json(response, 200, {
        'Cache-Control': RESPONSE_CACHE_CONTROL,
      })
    } catch {
      if (request.signal.aborted) {
        return new Response(null, {
          status: 499,
        })
      }

      return json(
        {
          error: 'Title localization is unavailable.',
        },
        503
      )
    }
  }
}

async function readInput(request: Request) {
  try {
    return normalizeLocalizedTitleNameBatchRequest(await request.json())
  } catch {
    return null
  }
}

function json(body: unknown, status: number, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  })
}
