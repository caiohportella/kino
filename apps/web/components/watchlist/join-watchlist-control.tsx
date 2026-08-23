'use client'

import { Clipboard, LogIn, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/localization/i18n'
import { cn } from '@/lib/utils'

export function JoinWatchlistControl({
  error,
  expanded,
  onChange,
  onCollapse,
  onExpand,
  onJoin,
  pending,
  value,
}: {
  error?: string
  expanded: boolean
  onChange: (value: string) => void
  onCollapse: () => void
  onExpand: () => void
  onJoin: () => void
  pending: boolean
  value: string
}) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!expanded) return

    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [expanded])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        expanded &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onCollapse()
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (expanded && event.key === 'Escape') {
        onCollapse()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [expanded, onCollapse])

  return (
    <div className={cn('relative min-w-0', expanded && 'flex-1 sm:flex-none')} ref={containerRef}>
      <div
        className={cn(
          'relative flex min-h-9 items-center overflow-hidden rounded-md border',
          'transition-[width,border-color,background-color,box-shadow] duration-500',
          'ease-[cubic-bezier(0.22,1,0.36,1)]',
          expanded
            ? 'w-full border-white/10 bg-kino-surface/95 shadow-xl backdrop-blur-xl sm:w-96'
            : 'lg:min-h-12 lg:px-5 lg:text-sm border-transparent bg-transparent'
        )}
      >
        <Button
          aria-label={t('modals.joinWatchlist')}
          className={cn('shrink-0', !expanded && 'px-3')}
          onClick={() => {
            if (expanded) {
              inputRef.current?.focus()
              return
            }

            onExpand()
          }}
          size={expanded ? 'icon' : 'default'}
          variant="secondary"
        >
          <Clipboard size={16} />

          {!expanded ? <span>{t('modals.joinWatchlist')}</span> : null}
        </Button>

        <div
          className={cn(
            'flex min-w-0 flex-1 items-center transition-opacity duration-300 ease-out',
            expanded ? 'delay-150 opacity-100' : 'pointer-events-none w-0 delay-0 opacity-0'
          )}
        >
          <input
            aria-label={t('modals.joinWatchlist')}
            className="min-w-0 flex-1 bg-transparent px-2 text-sm font-medium uppercase text-kino-text outline-none placeholder:normal-case placeholder:text-kino-muted"
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && value.trim() && !pending) {
                event.preventDefault()
                onJoin()
              }
            }}
            placeholder="ABCD1234"
            ref={inputRef}
            tabIndex={expanded ? 0 : -1}
            value={value}
          />

          {value ? (
            <Button
              aria-label={t('common.clear')}
              className="shrink-0"
              onClick={() => onChange('')}
              size="icon"
              variant="ghost"
            >
              <X size={15} />
            </Button>
          ) : null}

          <Button
            aria-label={t('modals.join')}
            className="mr-1 shrink-0"
            disabled={!value.trim() || pending}
            onClick={onJoin}
            size="icon"
          >
            <LogIn className={pending ? 'animate-pulse' : undefined} size={16} />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="absolute right-0 top-[calc(100%+0.25rem)] z-50 max-w-72 rounded-md border border-red-400/20 bg-kino-surface/95 px-3 py-2 text-xs text-red-300 shadow-xl backdrop-blur-xl">
          {error}
        </div>
      ) : null}
    </div>
  )
}
