import type { MediaType } from '@kino/core'

export interface ProviderDestination {
  kind: 'direct' | 'search' | 'homepage'
  providerName: string
  webUrl: string
}

export interface ProviderDestinationContext {
  mediaType: MediaType
  providerId: number
  providerName: string
  region: string
  releaseYear?: number
  title: string
  tmdbId: number
}

type ProviderRule = {
  pattern: RegExp
  regions?: string[]
  resolve: (
    context: ProviderDestinationContext,
    query: string
  ) => Omit<ProviderDestination, 'providerName'>
}

const PROVIDER_RULES: ProviderRule[] = [
  {
    pattern: /amazon|prime video/i,
    resolve: (_context, query) => ({
      kind: 'search',
      webUrl: `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${query}`,
    }),
  },
  {
    pattern: /claro/i,
    regions: ['BR'],
    resolve: (_context, query) => ({
      kind: 'search',
      webUrl: `https://www.clarotvmais.com.br/busca?q=${query}`,
    }),
  },
  {
    pattern: /filmelier/i,
    regions: ['BR'],
    resolve: (_context, query) => ({
      kind: 'search',
      webUrl: `https://www.filmelier.com/br/busca?q=${query}`,
    }),
  },
  {
    pattern: /apple tv/i,
    resolve: (_context, query) => ({
      kind: 'search',
      webUrl: `https://tv.apple.com/search?term=${query}`,
    }),
  },
  {
    pattern: /disney/i,
    resolve: () => ({ kind: 'homepage', webUrl: 'https://www.disneyplus.com/' }),
  },
  {
    pattern: /\bmax\b|hbo/i,
    resolve: () => ({ kind: 'homepage', webUrl: 'https://www.max.com/' }),
  },
  {
    pattern: /google play|youtube/i,
    resolve: (context, query) => ({
      kind: 'search',
      webUrl: `https://www.youtube.com/results?search_query=${query}%20${
        context.mediaType === 'tv' ? 'series' : 'movie'
      }`,
    }),
  },
  {
    pattern: /paramount/i,
    resolve: (_context, query) => ({
      kind: 'search',
      webUrl: `https://www.paramountplus.com/search/?q=${query}`,
    }),
  },
  {
    pattern: /netflix/i,
    resolve: (_context, query) => ({
      kind: 'search',
      webUrl: `https://www.netflix.com/search?q=${query}`,
    }),
  },
  {
    pattern: /globoplay/i,
    regions: ['BR'],
    resolve: (_context, query) => ({
      kind: 'search',
      webUrl: `https://globoplay.globo.com/busca/?q=${query}`,
    }),
  },
  {
    pattern: /mubi/i,
    resolve: (_context, query) => ({
      kind: 'search',
      webUrl: `https://mubi.com/search?query=${query}`,
    }),
  },
  {
    pattern: /\bplex\b/i,
    resolve: (_context, query) => ({
      kind: 'search',
      webUrl: `https://watch.plex.tv/search?q=${query}`,
    }),
  },
  {
    pattern: /flixfling/i,
    resolve: () => ({ kind: 'homepage', webUrl: 'https://www.flixfling.com/' }),
  },
  {
    pattern: /microsoft/i,
    resolve: (_context, query) => ({
      kind: 'search',
      webUrl: `https://www.microsoft.com/store/search?q=${query}`,
    }),
  },
  {
    pattern: /fandango|vudu/i,
    regions: ['US'],
    resolve: (_context, query) => ({
      kind: 'search',
      webUrl: `https://athome.fandango.com/content/movies/search?searchString=${query}`,
    }),
  },
]

export function resolveProviderDestination(
  context: ProviderDestinationContext
): ProviderDestination {
  const rule = PROVIDER_RULES.find(({ pattern }) => pattern.test(context.providerName))
  if (!rule) {
    return {
      kind: 'homepage',
      providerName: context.providerName,
      webUrl: 'https://www.justwatch.com/',
    }
  }

  const region = context.region.toUpperCase()
  if (rule.regions && !rule.regions.includes(region)) {
    return {
      kind: 'homepage',
      providerName: context.providerName,
      webUrl: 'https://www.justwatch.com/',
    }
  }

  const titleQuery = [context.title.trim(), context.releaseYear || null].filter(Boolean).join(' ')
  return {
    ...rule.resolve(context, encodeURIComponent(titleQuery)),
    providerName: context.providerName,
  }
}
