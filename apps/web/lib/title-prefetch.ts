import type { QueryClient } from '@tanstack/query-core'
import {
  type LocalizedTitleSummary,
  type TitleDetailsQueryInput,
  type TitleSummaryQueryInput,
  titleDetailsQueryOptions,
  titleSummaryQueryOptions,
} from './title-queries.ts'

export const TITLE_PREFETCH_CONCURRENCY = 4

interface PrefetchQueue {
  active: number
  readonly pending: Array<() => void>
}

export interface NavigationTitleDetailsPrefetchInput<Details extends LocalizedTitleSummary>
  extends TitleDetailsQueryInput<Details> {
  readonly intent: string
}

const queues = new WeakMap<QueryClient, PrefetchQueue>()

export function prefetchTitleSummary(
  queryClient: QueryClient,
  input: TitleSummaryQueryInput
): Promise<void> {
  return runBounded(queryClient, async () => {
    await queryClient.ensureQueryData(titleSummaryQueryOptions(input))
  })
}

export function prefetchTitleDetailsOnNavigation<Details extends LocalizedTitleSummary>(
  queryClient: QueryClient,
  input: NavigationTitleDetailsPrefetchInput<Details>
): Promise<void> {
  if (input.intent !== 'navigation') {
    return Promise.reject(new TypeError('Full title details require navigation intent.'))
  }

  return runBounded(queryClient, async () => {
    await queryClient.ensureQueryData(titleDetailsQueryOptions(queryClient, input))
  })
}

function runBounded(queryClient: QueryClient, task: () => Promise<void>): Promise<void> {
  const queue = queues.get(queryClient) ?? { active: 0, pending: [] }
  queues.set(queryClient, queue)

  return new Promise((resolve, reject) => {
    const run = () => {
      queue.active += 1
      task()
        .then(resolve, reject)
        .finally(() => {
          queue.active -= 1
          queue.pending.shift()?.()
        })
    }

    if (queue.active < TITLE_PREFETCH_CONCURRENCY) run()
    else queue.pending.push(run)
  })
}
