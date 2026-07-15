'use client'

import { Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/toast-provider'
import { useTranslation } from '@/lib/i18n'

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
  const { notify } = useToast()
  const { t } = useTranslation()
  const buttonLabel = label || t('common.share')

  async function share() {
    const absoluteUrl = new URL(url, window.location.origin).toString()
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: absoluteUrl })
        return
      }
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(absoluteUrl)
      else fallbackCopy(absoluteUrl)
      notify({ tone: 'success', title: t('common.linkCopied') })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      notify({ tone: 'error', title: t('common.copyFailed') })
    }
  }

  return (
    <Button
      aria-label={buttonLabel}
      className={className}
      onClick={() => void share()}
      variant="secondary"
    >
      <Share2 aria-hidden="true" size={17} />
      <span>{buttonLabel}</span>
    </Button>
  )
}

function fallbackCopy(value: string) {
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('Copy failed')
}
