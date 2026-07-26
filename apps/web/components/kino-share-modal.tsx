'use client'

import {
  Check,
  Copy,
  ExternalLink,
  Facebook,
  Instagram,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Send,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/toast-provider'
import { useTranslation } from '@/lib/i18n'
import {
  isShareCancellation,
  type KinoShareResource,
  normalizeShareUrl,
  shareDestinations,
  supportsFileShare,
  supportsNativeShare,
} from '@/lib/share-destinations'

export function KinoShareModal({
  onOpenChange,
  open,
  resource,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
  resource: KinoShareResource
}) {
  const { t } = useTranslation()
  const { notify } = useToast()
  const [copied, setCopied] = useState(false)
  const [imageLoading, setImageLoading] = useState(Boolean(resource.imageUrl))
  const [imageFailed, setImageFailed] = useState(false)
  const [shareFile, setShareFile] = useState<File>()
  const copyTimer = useRef<number | null>(null)
  const canonicalUrl = useMemo(
    () =>
      typeof window === 'undefined'
        ? resource.canonicalUrl
        : normalizeShareUrl(resource.canonicalUrl, window.location.origin),
    [resource.canonicalUrl]
  )
  const text = resource.shareText || t('sharing.defaultText', { title: resource.title })
  const canNativeShare = supportsNativeShare()
  const canShareImage = supportsFileShare(shareFile)

  useEffect(() => {
    if (!open || !resource.imageUrl || typeof window === 'undefined') return
    const controller = new AbortController()
    const imageUrl = normalizeShareUrl(resource.imageUrl, window.location.origin)
    void fetch(imageUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Image unavailable')
        return response.blob()
      })
      .then((blob) => {
        const extension = blob.type.includes('png') ? 'png' : 'jpg'
        setShareFile(new File([blob], `kino-share.${extension}`, { type: blob.type }))
      })
      .catch(() => setShareFile(undefined))
    return () => controller.abort()
  }, [open, resource.imageUrl])

  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current)
    },
    []
  )

  async function copyLink() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(canonicalUrl)
      setCopied(true)
      copyTimer.current = window.setTimeout(() => setCopied(false), 1800)
    } catch {
      notify({ tone: 'error', title: t('sharing.copyFailed') })
    }
  }

  async function nativeShare(includeFile: boolean) {
    const baseData: ShareData = { title: resource.title, text, url: canonicalUrl }
    try {
      if (includeFile && shareFile && supportsFileShare(shareFile)) {
        await navigator.share({ ...baseData, files: [shareFile] })
      } else {
        await navigator.share(baseData)
      }
    } catch (error) {
      if (isShareCancellation(error)) return
      if (includeFile) {
        try {
          await navigator.share(baseData)
          return
        } catch (retryError) {
          if (isShareCancellation(retryError)) return
        }
      }
      notify({ tone: 'error', title: t('sharing.unavailable') })
    }
  }

  const shareContext = { title: resource.title, text, url: canonicalUrl }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="gap-5 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('common.share')}</DialogTitle>
          <DialogDescription>{t('sharing.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 rounded-md bg-muted/50 p-3">
          <div className="relative aspect-video overflow-hidden rounded-md bg-kino-bg">
            {resource.imageUrl && !imageFailed ? (
              <>
                {imageLoading ? <Skeleton className="absolute inset-0 size-full" /> : null}
                <img
                  alt=""
                  className="size-full object-cover"
                  onError={() => {
                    setImageFailed(true)
                    setImageLoading(false)
                  }}
                  onLoad={() => setImageLoading(false)}
                  src={resource.imageUrl}
                />
              </>
            ) : (
              <div className="grid size-full place-items-center bg-kino-accent/10 text-lg font-black italic text-kino-accent">
                Kino.
              </div>
            )}
          </div>
          <div className="min-w-0 self-center">
            <div className="line-clamp-2 font-semibold text-kino-text">{resource.title}</div>
            {resource.subtitle ? (
              <div className="mt-1 line-clamp-2 text-xs leading-5 text-kino-muted">
                {resource.subtitle}
              </div>
            ) : null}
            <div className="mt-2 text-xs font-semibold text-kino-accent">Kino</div>
          </div>
        </div>

        {resource.shareable === false ? (
          <p className="rounded-md bg-muted/50 p-4 text-sm text-kino-muted">
            {t('sharing.privateUnavailable')}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-x-2 gap-y-5 sm:grid-cols-5">
              {shareDestinations.map((destination) => (
                <DestinationLink
                  color={destination.color}
                  href={destination.buildUrl(shareContext)}
                  icon={destination.id}
                  key={destination.id}
                  label={t(destination.labelKey)}
                />
              ))}
              {canShareImage ? (
                <>
                  <DestinationButton
                    color="#c13584"
                    icon={<Instagram />}
                    label={t('sharing.instagramStories')}
                    onClick={() => void nativeShare(true)}
                  />
                  <DestinationButton
                    color="#111111"
                    icon={<span className="text-sm font-black">TT</span>}
                    label={t('sharing.tiktok')}
                    onClick={() => void nativeShare(true)}
                  />
                </>
              ) : null}
              <DestinationButton
                color="rgb(var(--kino-elevated-rgb) / 1)"
                icon={copied ? <Check /> : <Copy />}
                label={copied ? t('sharing.copied') : t('sharing.copyLink')}
                onClick={() => void copyLink()}
              />
              {canNativeShare ? (
                <DestinationButton
                  color="rgb(var(--kino-elevated-rgb) / 1)"
                  icon={<MoreHorizontal />}
                  label={t('sharing.moreOptions')}
                  onClick={() => void nativeShare(canShareImage)}
                />
              ) : (
                <DestinationLink
                  color="rgb(var(--kino-elevated-rgb) / 1)"
                  href={`mailto:?subject=${encodeURIComponent(resource.title)}&body=${encodeURIComponent(`${text}\n${canonicalUrl}`)}`}
                  icon="email"
                  label={t('sharing.email')}
                />
              )}
            </div>
            {canShareImage ? (
              <p className="text-xs leading-5 text-kino-muted">
                {t('sharing.finishInSelectedApp')}
              </p>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DestinationButton({
  color,
  icon,
  label,
  onClick,
}: {
  color: string
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-label={label}
      className="group grid min-w-0 justify-items-center gap-2 rounded-md text-center outline-none focus-visible:ring-2 focus-visible:ring-kino-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kino-panel"
      onClick={onClick}
      type="button"
    >
      <span
        className="grid size-12 place-items-center rounded-full text-white ring-1 ring-white/15 transition-transform duration-150 group-hover:-translate-y-0.5 group-active:translate-y-px motion-reduce:transition-none"
        style={{ backgroundColor: color }}
      >
        {icon}
      </span>
      <span className="line-clamp-2 text-[11px] font-semibold leading-4 text-kino-muted">
        {label}
      </span>
    </button>
  )
}

function DestinationLink({
  color,
  href,
  icon,
  label,
}: {
  color: string
  href: string
  icon: string
  label: string
}) {
  const glyph =
    icon === 'whatsapp' ? (
      <MessageCircle />
    ) : icon === 'reddit' ? (
      <span className="text-xs font-black">R</span>
    ) : icon === 'x' ? (
      <span className="text-sm font-black">X</span>
    ) : icon === 'facebook' ? (
      <Facebook />
    ) : icon === 'telegram' ? (
      <Send />
    ) : icon === 'email' ? (
      <Mail />
    ) : (
      <ExternalLink />
    )

  return (
    <a
      aria-label={label}
      className="group grid min-w-0 justify-items-center gap-2 rounded-md text-center outline-none focus-visible:ring-2 focus-visible:ring-kino-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kino-panel"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span
        className="grid size-12 place-items-center rounded-full text-white ring-1 ring-white/15 transition-transform duration-150 group-hover:-translate-y-0.5 group-active:translate-y-px motion-reduce:transition-none"
        style={{ backgroundColor: color }}
      >
        {glyph}
      </span>
      <span className="line-clamp-2 text-[11px] font-semibold leading-4 text-kino-muted">
        {label}
      </span>
    </a>
  )
}
