'use client'

import { Heart, LoaderCircle } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function ReviewLikeButton({
  canLike,
  likedByViewer,
  likeCount,
  onAuthRequired,
  onLike,
  pending,
}: {
  canLike: boolean
  likedByViewer: boolean
  likeCount: number
  onAuthRequired: () => void
  onLike: () => void
  pending: boolean
}) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        aria-busy={pending}
        aria-pressed={likedByViewer}
        className={cn(
          'focus-ring inline-flex items-center gap-1.5 rounded-md px-1 py-1 font-medium transition-colors',
          likedByViewer ? 'text-kino-accent' : 'text-kino-muted hover:text-kino-text',
          pending && 'opacity-70'
        )}
        disabled={pending}
        onClick={() => (canLike ? onLike() : onAuthRequired())}
        type="button"
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
        ) : (
          <Heart aria-hidden="true" fill={likedByViewer ? 'currentColor' : 'none'} size={16} />
        )}
        {t(likedByViewer ? 'reviews.unlike' : 'reviews.like')}
      </button>
      <span className="text-kino-subtle">{t('reviews.likeCount', { count: likeCount })}</span>
    </div>
  )
}
