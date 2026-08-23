import { getDiscoverDateWindow } from './feed-dates.ts'

export function getDiscoverFeedQueries(now = new Date()) {
  const { recentStart, today, tomorrow, upcomingEnd } = getDiscoverDateWindow(now)

  return {
    window: {
      recentStart,
      today,
      tomorrow,
      upcomingEnd,
    },

    popularMovies: {
      regionAware: true,
      params: {
        sort_by: 'popularity.desc',
        'release_date.lte': today,
        include_adult: 'false',
        include_video: 'false',
      },
    },

    newReleases: {
      regionAware: true,
      params: {
        sort_by: 'popularity.desc',
        'release_date.gte': recentStart,
        'release_date.lte': today,
        with_release_type: '3|2|4',
        include_adult: 'false',
        include_video: 'false',
      },
    },

    upcoming: {
      regionAware: true,
      params: {
        sort_by: 'popularity.desc',
        'release_date.gte': tomorrow,
        'release_date.lte': upcomingEnd,
        with_release_type: '3|2',
        include_adult: 'false',
        include_video: 'false',
      },
    },
  } as const
}
