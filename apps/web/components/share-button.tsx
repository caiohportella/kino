'use client'

import { Check, Share2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/toast-provider'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { shareResource } from '@/lib/native-share'

export function ShareButton({
  className,
  label,
  text,
  title,
  url,
}: {
  className?: string
  label?: string
  text?: string
  title: string
  url: string
}) {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<number | null>(null)
  const { t } = useTranslation()
  const { notify } = useToast()
  const buttonLabel = label || t('common.share')

  useEffect(
    () => () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current)
    },
    []
  )

  async function handleShare() {
    const hasNativeShare = typeof navigator.share === 'function'
    try {
      const result = await shareResource(
        { canonicalUrl: url, shareText: text, title },
        {
          copy: async (value) => {
            if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
            await navigator.clipboard.writeText(value)
          },
          origin: window.location.origin,
          share: navigator.share?.bind(navigator),
        }
      )
      if (result !== 'copied') return
      setCopied(true)
      resetTimer.current = window.setTimeout(() => setCopied(false), 1800)
    } catch {
      notify({ tone: 'error', title: t(hasNativeShare ? 'common.failed' : 'common.copyFailed') })
    }
  }

  return (
    <Button
      aria-label={copied ? t('common.linkCopied') : buttonLabel}
      className={className}
      onClick={() => void handleShare()}
      variant="secondary"
    >
      {copied ? <Check aria-hidden="true" size={17} /> : <Share2 aria-hidden="true" size={17} />}
      <span aria-live="polite">{copied ? t('common.linkCopied') : buttonLabel}</span>
    </Button>
  )
}
