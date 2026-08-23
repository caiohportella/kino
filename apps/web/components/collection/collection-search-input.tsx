'use client'

import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/lib/localization/i18n'

export function CollectionSearchInput({
  onChange,
  value,
}: {
  onChange: (value: string) => void
  value: string
}) {
  const { t } = useTranslation()
  const [queryDraft, setQueryDraft] = useState(value)
  const lastCommittedQueryRef = useRef(value)

  useEffect(() => {
    if (value === lastCommittedQueryRef.current) {
      return
    }

    lastCommittedQueryRef.current = value
    setQueryDraft(value)
  }, [value])

  useEffect(() => {
    const nextQuery = queryDraft.trim()

    if (nextQuery === value) {
      return
    }

    const timeout = window.setTimeout(() => {
      lastCommittedQueryRef.current = nextQuery
      onChange(nextQuery)
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [onChange, queryDraft, value])

  return (
    <div className="relative">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-kino-muted"
      />

      <input
        aria-label={t('profileCollections.search', {
          defaultValue: 'Search collection',
        })}
        className="h-10 w-full rounded-md border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-kino-text outline-none transition-colors placeholder:text-kino-muted focus:border-kino-accent/60"
        onChange={(event) => setQueryDraft(event.target.value)}
        placeholder={t('profileCollections.searchPlaceholder', {
          defaultValue: 'Search by title...',
        })}
        type="search"
        value={queryDraft}
      />
    </div>
  )
}
