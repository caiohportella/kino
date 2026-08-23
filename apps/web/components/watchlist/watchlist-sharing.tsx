'use client'

import type { WatchlistVisibility } from '@kino/core'
import { Check, Copy, Globe2, Link2, Lock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/toast-provider'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/localization/i18n'
import { cn } from '@/lib/utils'

export function WatchlistSharedBadge({ className }: { className?: string }) {
  return <WatchlistVisibilityBadge className={className} visibility="shared" />
}

export function WatchlistVisibilityBadge({
  className,
  visibility,
  variant = 'default',
}: {
  className?: string
  visibility: WatchlistVisibility
  variant?: 'default' | 'overlay'
}) {
  const { t } = useTranslation()
  const Icon = visibility === 'private' ? Lock : visibility === 'shared' ? Link2 : Globe2

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md border text-xs font-semibold',
        variant === 'overlay'
          ? 'border-kino-accent/50 bg-black/30 px-2.5 py-1 text-white/85 backdrop-blur-md'
          : 'min-h-7 border-kino-accent/20 bg-kino-accent/6 px-3 py-1 text-kino-muted',
        className
      )}
    >
      <Icon
        aria-hidden="true"
        className={variant === 'overlay' ? 'text-kino-accent' : undefined}
        size={variant === 'overlay' ? 12 : 13}
      />

      {t(`watchlists.visibilityLabels.${visibility}`)}
    </span>
  )
}

export function ShareCodeCopyButton({
  code,
  showCode = false,
  iconOnly = false,
  className,
}: {
  code: string
  showCode?: boolean
  iconOnly?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const { notify } = useToast()
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current)
    },
    []
  )

  async function copyCode() {
    if (!code || copied) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(
        `${window.location.origin}/watchlists/shared/${encodeURIComponent(code)}`
      )
      setCopied(true)
      notify({ tone: 'success', title: t('watchlists.copiedToClipboard') })
      resetTimer.current = window.setTimeout(() => setCopied(false), 1800)
    } catch {
      notify({ tone: 'error', title: t('watchlists.copyFailed') })
    }
  }

  return (
    <Button
      aria-label={copied ? t('watchlists.copied') : t('watchlists.copyCode')}
      className={cn(
        'min-w-28 transition-transform duration-150 motion-reduce:transition-none active:scale-95 motion-reduce:active:scale-100',
        copied && 'scale-95 motion-reduce:scale-100',
        className
      )}
      disabled={!code}
      onClick={copyCode}
      type="button"
      variant="secondary"
    >
      {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
      {iconOnly ? (
        <span className="sr-only">
          {copied ? t('watchlists.copied') : t('watchlists.copyCode')}
        </span>
      ) : (
        <span className={showCode ? 'font-mono tracking-[0.16em]' : undefined}>
          {copied ? t('watchlists.copied') : showCode ? code : t('watchlists.copyCode')}
        </span>
      )}
    </Button>
  )
}

export function ShareCodeDisplay({ code, className }: { code: string; className?: string }) {
  const { t } = useTranslation()
  return (
    <div
      aria-label={`${t('modals.shareCode')}: ${code}`}
      className={cn(
        'flex min-h-11 min-w-0 items-stretch overflow-visible rounded-md border border-border bg-muted/45',
        className
      )}
      role="group"
    >
      <span className="flex min-w-0 flex-1 select-all items-center px-3 font-mono text-sm font-semibold tracking-[0.16em] text-foreground whitespace-nowrap">
        {code}
      </span>
      <ShareCodeCopyButton
        className="min-h-11 min-w-11 rounded-l-none border-l border-border px-3"
        code={code}
        iconOnly
      />
    </div>
  )
}
