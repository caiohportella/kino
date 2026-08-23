import type { WatchlistVisibility } from '@kino/core'
import { Globe2, Link2, Lock } from 'lucide-react'
import { useTranslation } from '@/lib/localization/i18n'
import { cn } from '@/lib/utils'

const options = [
  { icon: Lock, value: 'private' },
  { icon: Link2, value: 'shared' },
  { icon: Globe2, value: 'public' },
] as const

export function WatchlistVisibilitySelector({
  disabled,
  onChange,
  value,
}: {
  disabled?: boolean
  onChange: (value: WatchlistVisibility) => void
  value: WatchlistVisibility
}) {
  const { t } = useTranslation()

  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-semibold text-kino-text">
        {t('watchlists.visibility')}
      </legend>
      {options.map((option) => {
        const Icon = option.icon
        const selected = value === option.value
        return (
          <label
            className={cn(
              'grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border p-3 transition-colors',
              'focus-within:ring-2 focus-within:ring-kino-accent focus-within:ring-offset-2 focus-within:ring-offset-kino-bg',
              selected
                ? 'border-kino-accent/60 bg-kino-accent/10'
                : 'border-border bg-muted/20 hover:bg-muted/40',
              disabled && 'cursor-not-allowed opacity-60'
            )}
            key={option.value}
          >
            <input
              checked={selected}
              className="sr-only"
              name="watchlist-visibility"
              onChange={() => onChange(option.value)}
              type="radio"
              value={option.value}
            />
            <Icon aria-hidden="true" className="mt-0.5 text-kino-accent" size={18} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-kino-text">
                {t(`watchlists.visibilityLabels.${option.value}`)}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-kino-muted">
                {t(`watchlists.visibilityDescriptions.${option.value}`)}
              </span>
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
