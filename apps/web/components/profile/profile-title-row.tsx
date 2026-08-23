'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { ProfileHorizontalRow } from '@/components/profile/profile-horizontal-row'
import { ProfileModal } from '@/components/profile/profile-modal'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/localization/i18n'

const PROFILE_ROW_LIMIT = 12

export function ProfileTitleRow<T>({
  desktopShowAllAction = false,
  items,
  previewLimit = PROFILE_ROW_LIMIT,
  renderTitleCard,
  rowClassName,
  showAllHref,
  title,
}: {
  desktopShowAllAction?: boolean
  items: T[]
  previewLimit?: number
  renderTitleCard: (item: T) => ReactNode
  rowClassName?: string
  showAllHref?: string
  title: string
}) {
  const { t } = useTranslation()

  const [showAllOpen, setShowAllOpen] = useState(false)

  const hasMore = items.length > previewLimit

  const openShowAll = () => {
    setShowAllOpen(true)
  }

  return (
    <ProfileHorizontalRow
      action={
        hasMore && showAllHref ? (
          <Link
            className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-kino-muted transition-colors hover:bg-white/5 hover:text-kino-text focus-ring"
            href={showAllHref}
          >
            {t('profile.viewAll')}
          </Link>
        ) : hasMore && desktopShowAllAction ? (
          <Button
            aria-haspopup="dialog"
            className="hidden lg:inline-flex"
            onClick={openShowAll}
            size="sm"
            variant="ghost"
          >
            {t('profile.showAll')}
          </Button>
        ) : null
      }
      after={
        hasMore && !showAllHref ? (
          <ProfileModal
            contentClassName="max-w-5xl"
            onOpenChange={setShowAllOpen}
            open={showAllOpen}
            title={title}
          >
            <div className="poster-grid min-h-0 flex-1 overflow-y-auto pr-1">
              {items.map(renderTitleCard)}
            </div>
          </ProfileModal>
        ) : null
      }
      rowClassName={rowClassName}
      title={title}
    >
      <>
        {items.slice(0, previewLimit).map(renderTitleCard)}

        {!showAllHref && desktopShowAllAction
          ? items.slice(previewLimit).map((item, index) => (
              <div className="hidden lg:contents" key={`profile-row-desktop-extra-${index}`}>
                {renderTitleCard(item)}
              </div>
            ))
          : null}

        {hasMore && !showAllHref ? (
          <Button
            aria-haspopup="dialog"
            className={
              desktopShowAllAction
                ? 'aspect-2/3 w-full self-start whitespace-normal text-center lg:hidden'
                : 'aspect-2/3 w-full self-start whitespace-normal text-center'
            }
            onClick={openShowAll}
            variant="secondary"
          >
            {t('profile.showAll')}
          </Button>
        ) : null}
      </>
    </ProfileHorizontalRow>
  )
}
