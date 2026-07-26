'use client'

import { Share2 } from 'lucide-react'
import { useState } from 'react'
import { KinoShareModal } from '@/components/kino-share-modal'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import type { KinoShareResourceType } from '@/lib/share-destinations'

export function ShareButton({
  className,
  label,
  text,
  title,
  url,
  type = 'title',
  subtitle,
  imageUrl,
  shareable = true,
}: {
  className?: string
  label?: string
  text?: string
  title: string
  url: string
  type?: KinoShareResourceType
  subtitle?: string
  imageUrl?: string | null
  shareable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  const buttonLabel = label || t('common.share')

  return (
    <>
      <Button
        aria-label={buttonLabel}
        className={className}
        onClick={() => setOpen(true)}
        variant="secondary"
      >
        <Share2 aria-hidden="true" size={17} />
        <span>{buttonLabel}</span>
      </Button>
      <KinoShareModal
        onOpenChange={setOpen}
        open={open}
        resource={{
          canonicalUrl: url,
          imageUrl,
          shareable,
          shareText: text,
          subtitle,
          title,
          type,
        }}
      />
    </>
  )
}
