import { useQuery } from '@tanstack/react-query'
import { getTMDbService } from '@/services/tmdb'
import { useLanguage } from '~/hooks/useLanguage'

export const PERSON_DATA_KEYS = {
  all: ['person'] as const,
  details: (personId: number, lang: string) => [...PERSON_DATA_KEYS.all, personId, 'details', lang] as const,
}

export function usePersonData(personId: number | null) {
  const language = useLanguage()

  return useQuery({
    queryKey: PERSON_DATA_KEYS.details(personId!, language),
    queryFn: async () => {
      if (!personId) throw new Error('Person ID is required')
      const tmdb = getTMDbService()
      tmdb.setLanguage(language)
      return tmdb.getPersonDetails(personId)
    },
    enabled: !!personId,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours (person data rarely changes frequently)
  })
}
