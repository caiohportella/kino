'use client'

import { REVIEW_MAX_LENGTH, type PublicUserSummary } from '@kino/core'
import { useState } from 'react'
import { RatingStars } from '@/components/rating-stars'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { ReviewAuthor } from './review-author'

export function ReviewComposer({
  author,
  rating,
  pending,
  onPublish,
}: {
  author: PublicUserSummary
  rating: number | null
  pending: boolean
  onPublish: (content: string) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const [content, setContent] = useState('')
  const remaining = REVIEW_MAX_LENGTH - content.length
  return (
    <div className="flex items-start gap-3">
      <ReviewAuthor author={author} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-kino-muted">
          <span>
            {t('reviews.reviewedBy')}{' '}
            <ReviewAuthor author={author} variant="name" />
          </span>
          {rating ? (
            <RatingStars
              label={t('reviews.ratingLabel')}
              readonly
              size="xs"
              value={rating}
            />
          ) : null}
        </div>
        <textarea
          aria-label={t('reviews.writeReview')}
          className="focus-ring mt-3 min-h-24 w-full resize-y rounded-md border border-white/10 bg-black/20 px-3 py-2.5 text-sm leading-6 text-kino-text placeholder:text-kino-muted"
          disabled={pending}
          maxLength={REVIEW_MAX_LENGTH}
          onChange={(event) => setContent(event.target.value)}
          placeholder={t('reviews.composer.placeholder')}
          value={content}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-kino-muted" role="status">
            {remaining <= 200 ? t('reviews.charactersRemaining', { count: remaining }) : ''}
          </span>
          <Button
            disabled={pending || !content.trim()}
            onClick={async () => {
              if (await onPublish(content)) setContent('')
            }}
            size="sm"
          >
            {pending ? t('common.loading') : t('reviews.publish')}
          </Button>
        </div>
      </div>
    </div>
  )
}
