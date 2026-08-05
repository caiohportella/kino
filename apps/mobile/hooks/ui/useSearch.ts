// Search hook for TMDb search
import { useCallback, useState } from 'react'
import { useReadyLanguage } from '~/hooks/useLanguage'
import { getTMDbService } from '~/services/tmdb'
import type { TMDbTitle } from '~/types'

export function useSearch() {
  const language = useReadyLanguage()
  const [results, setResults] = useState<TMDbTitle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(
    async (query: string) => {
      if (!query.trim() || !language) {
        setResults([])
        return
      }

      setLoading(true)
      setError(null)

      try {
        const tmdb = getTMDbService()
        tmdb.setLanguage(language)
        const response = await tmdb.search(query)
        setResults(response.results)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed')
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    [language]
  )

  const clearResults = useCallback(() => {
    setResults([])
    setError(null)
  }, [])

  return {
    results,
    loading,
    error,
    search,
    clearResults,
  }
}
