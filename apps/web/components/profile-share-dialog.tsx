'use client'

import { Check, Copy, Share2 } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/toast-provider'
import { useTranslation } from '@/lib/i18n'

export function ProfileShareDialog({ username }: { username: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [profileUrl, setProfileUrl] = useState('')
  const { notify } = useToast()
  const { t } = useTranslation()

  useEffect(() => {
    const url = new URL(`/${username}`, window.location.origin).toString()
    setProfileUrl(url)
    void QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
      color: { dark: '#101112', light: '#ffffff' },
    }).then(setQrCode)
  }, [username])

  async function copyUrl() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(profileUrl)
      else fallbackCopy(profileUrl)
      setCopied(true)
      notify({ tone: 'success', title: t('profile.linkCopied') })
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      notify({ tone: 'error', title: t('profile.copyFailed') })
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button onClick={() => setOpen(true)}>
        <Share2 data-icon="inline-start" />
        {t('profile.shareProfile')}
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('profile.shareProfile')}</DialogTitle>
          <DialogDescription>{t('profile.shareDescription')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-5 pt-2">
          {qrCode ? (
            <img
              alt={t('profile.qrCodeAlt')}
              className="size-64 rounded-md bg-white p-3"
              src={qrCode}
            />
          ) : null}
          <Button
            className="h-auto w-full justify-between gap-3 py-3"
            onClick={copyUrl}
            variant="secondary"
          >
            <span className="min-w-0 truncate text-left underline decoration-kino-accent/60 underline-offset-4">
              {profileUrl}
            </span>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </Button>
          <span aria-live="polite" className="min-h-5 text-xs text-kino-muted">
            {copied ? t('profile.copiedFeedback') : t('profile.tapToCopy')}
          </span>
        </div>
      </DialogContent>
    </Dialog>
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
