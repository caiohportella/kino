import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes
      staleTime: 1000 * 60 * 5,
      // Cache is kept for 10 minutes
      gcTime: 1000 * 60 * 10,
      // Retry failed queries 2 times
      retry: 2,
    },
  },
})
