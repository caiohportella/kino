'use client'

import { REVIEW_MAX_LENGTH } from '@kino/core'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'

export function ReviewEditor({
  initialContent,
  pending,
  onCancel,
  onSave,
}: {
  initialContent: string
  pending: boolean
  onCancel: () => void
  onSave: (content: string) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const [content, setContent] = useState(initialContent)
  const remaining = REVIEW_MAX_LENGTH - content.length

  return (
    <div className="grid gap-2">
      <textarea
        aria-label={t('reviews.edit')}
        autoFocus
        className="focus-ring min-h-28 w-full resize-y rounded-md border border-white/10 bg-black/20 px-3 py-2.5 text-sm leading-6 text-kino-text"
        disabled={pending}
        maxLength={REVIEW_MAX_LENGTH}
        onChange={(event) => setContent(event.target.value)}
        value={content}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-kino-muted">
          {remaining <= 200 ? t('reviews.charactersRemaining', { count: remaining }) : ''}
        </span>
        <div className="flex gap-2">
          <Button disabled={pending} onClick={onCancel} size="sm" variant="ghost">
            {t('common.cancel')}
          </Button>
          <Button
            disabled={pending || !content.trim() || content.trim() === initialContent.trim()}
            onClick={() => void onSave(content)}
            size="sm"
          >
            {t('reviews.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
