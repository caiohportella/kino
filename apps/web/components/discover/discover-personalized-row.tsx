'use client'

import { MediaSection } from '@/components/media/media-section'
import type { PersonalizedRow } from '@/lib/discover/personalized-rows'
import { useTranslation } from '@/lib/localization/i18n'

interface DiscoverPersonalizedRowProps {
  row: PersonalizedRow
}

export function DiscoverPersonalizedRow({ row }: DiscoverPersonalizedRowProps) {
  const { t } = useTranslation()

  const title = getRowTitle(row, t)

  return <MediaSection items={row.items} title={title} />
}

function getRowTitle(row: PersonalizedRow, t: ReturnType<typeof useTranslation>['t']) {
  switch (row.source.kind) {
    case 'title':
      return t('discover.personalized.becauseWatched', {
        defaultValue: 'Because you watched {{title}}',
        title: row.source.title,
      })

    case 'director':
      return t('discover.personalized.moreFromDirector', {
        defaultValue: 'More from {{director}}',
        director: row.source.name,
      })

    case 'genre':
      return t('discover.personalized.moreGenre', {
        defaultValue: 'More {{genre}} for you',
        genre: row.source.name,
      })

    case 'studio':
      return t('discover.personalized.moreFromStudio', {
        defaultValue: 'More from {{studio}}',
        studio: row.source.name,
      })
  }
}
