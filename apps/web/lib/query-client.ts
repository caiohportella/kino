'use client'

import { QueryClient } from '@tanstack/react-query'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 10,
        retry: 2,
        staleTime: 1000 * 60 * 5,
      },
    },
  })
}
