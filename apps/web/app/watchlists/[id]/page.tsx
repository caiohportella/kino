'use client'

import type { UserProfile, Watchlist, WatchlistItemDetails } from '@kino/core'
import { Button, Card, Dialog, EmptyState, Field, Poster, TextArea } from '@kino/ui'
import { Check, Copy, LogOut, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoadingPanel } from '@/components/loading-panel'
import { PageHeader } from '@/components/page-header'
import {
  AlertDialog,
  AlertDialogButtonAction,
  AlertDialogButtonCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { buttonVariants } from '@/components/ui/button'
import { useToast } from '@/components/toast-provider'
import type { LocalizedTitleMap } from '@/lib/use-localized-titles'
import { localizedTitleKey, useLocalizedTitles } from '@/lib/use-localized-titles'
import { db, getTmdb } from '@/lib/services'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { useAuthStore } from '@/stores/auth-store'

interface WatchlistDetailData {
  watchlist: Watchlist | null
  items: WatchlistItemDetails[]
  participants: UserProfile[]
}

export default function WatchlistDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const { i18n, t } = useTranslation()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<WatchlistItemDetails | null>(null)
  const detailQueryKey = ['watchlist-detail', params.id] as const

  const query = useQuery<WatchlistDetailData>({
    queryKey: detailQueryKey,
    queryFn: async () => {
      const [watchlist, items] = await Promise.all([db.getWatchlist(params.id), db.getWatchlistItems(params.id)])
      if (!watchlist) return { watchlist, items, participants: [] }

      const [owner, collaborators] = await Promise.all([
        db.getUserProfile(watchlist.userId),
        db.getWatchlistCollaborators(watchlist.id),
      ])
      const participants = Array.from(
        new Map([owner, ...collaborators].filter((profile): profile is UserProfile => Boolean(profile)).map((profile) => [profile.id, profile])).values()
      )

      return { watchlist, items, participants }
    },
  })
  const watchlistItems = query.data?.items || []
  const localizedTitles = useLocalizedTitles(
    watchlistItems.map((item) => ({ tmdbId: item.title.tmdb_id, type: item.title.type }))
  )

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium',
      }),
    [i18n.language]
  )
  const isOwner = user?.id === query.data?.watchlist?.userId
  const copyText = query.data?.watchlist?.shareCode || ''
  const localizedTitleMap = localizedTitles.data || {}
  const removeTargetTitle = removeTarget
    ? localizedTitleMap[localizedTitleKey({ tmdbId: removeTarget.title.tmdb_id, type: removeTarget.title.type })]?.title ||
      removeTarget.title.title
    : t('diary.unknownTitle')

  const removeMutation = useMutation({
    mutationFn: (item: WatchlistItemDetails) => db.removeFromWatchlist(params.id, item.title.id),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: detailQueryKey })
      const previous = queryClient.getQueryData<WatchlistDetailData>(detailQueryKey)
      queryClient.setQueryData<WatchlistDetailData>(detailQueryKey, (current) =>
        current ? { ...current, items: current.items.filter((entry) => entry.id !== item.id) } : current
      )
      return { previous }
    },
    onError: (_error, _item, context) => {
      if (context?.previous) queryClient.setQueryData(detailQueryKey, context.previous)
      notify({ tone: 'error', title: t('watchlists.failedToRemoveItem') })
    },
    onSuccess: () => {
      notify({ tone: 'success', title: t('watchlists.itemRemoved') })
      setRemoveTarget(null)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: detailQueryKey }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => db.deleteWatchlist(params.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['watchlists', user?.id] })
      const previous = queryClient.getQueryData<Watchlist[]>(['watchlists', user?.id])
      queryClient.setQueryData<Watchlist[]>(['watchlists', user?.id], (current) =>
        current?.filter((watchlist) => watchlist.id !== params.id) ?? current
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(['watchlists', user?.id], context.previous)
      notify({ tone: 'error', title: t('watchlists.failedToDeleteWatchlist') })
    },
    onSuccess: () => {
      notify({ tone: 'success', title: t('watchlists.deleted') })
      queryClient.removeQueries({ queryKey: detailQueryKey })
      queryClient.invalidateQueries({ queryKey: ['watchlists', user?.id] })
      router.replace('/watchlists')
    },
  })

  const leaveMutation = useMutation({
    mutationFn: () => db.leaveWatchlist(params.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['watchlists', user?.id] })
      const previous = queryClient.getQueryData<Watchlist[]>(['watchlists', user?.id])
      queryClient.setQueryData<Watchlist[]>(['watchlists', user?.id], (current) =>
        current?.filter((watchlist) => watchlist.id !== params.id) ?? current
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(['watchlists', user?.id], context.previous)
      notify({ tone: 'error', title: t('watchlists.failedToLeaveWatchlist') })
    },
    onSuccess: () => {
      notify({ tone: 'success', title: t('watchlists.left') })
      queryClient.removeQueries({ queryKey: detailQueryKey })
      queryClient.invalidateQueries({ queryKey: ['watchlists', user?.id] })
      router.replace('/watchlists')
    },
  })

  async function handleCopyShareCode() {
    if (!copyText) return

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      notify({ tone: 'success', title: t('watchlists.copiedToClipboard') })
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      notify({ tone: 'error', title: t('watchlists.copyFailed') })
    }
  }

  if (query.isLoading) return <LoadingPanel label={t('watchlists.loadingWatchlist')} />

  if (!query.data?.watchlist) {
    return <EmptyState body={t('watchlists.notFoundBody')} title={t('watchlists.notFound')} />
  }

  const { watchlist, items, participants } = query.data

  return (
    <div className="content-frame">
      <PageHeader
        action={
          <div className="flex flex-wrap gap-3">
            {copyText ? (
              <Button
                aria-label={t('watchlists.copyShareCode')}
                className={cn('transition-transform duration-150 active:scale-95', copied && 'scale-95')}
                onClick={handleCopyShareCode}
                tone="secondary"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span className="font-mono tracking-[0.16em]">{copyText}</span>
              </Button>
            ) : null}
            {isOwner ? (
              <>
                <Button onClick={() => setEditOpen(true)} tone="secondary">
                  <Pencil size={16} />
                  {t('watchlists.edit')}
                </Button>
                <Button disabled={deleteMutation.isPending} onClick={() => setDeleteOpen(true)} tone="danger">
                  <Trash2 size={16} />
                  {deleteMutation.isPending ? t('watchlists.deleting') : t('common.delete')}
                </Button>
              </>
            ) : user ? (
              <Button disabled={leaveMutation.isPending} onClick={() => setLeaveOpen(true)} tone="danger">
                <LogOut size={16} />
                {leaveMutation.isPending ? t('watchlists.leaving') : t('watchlists.leave')}
              </Button>
            ) : null}
          </div>
        }
        body={watchlist.description || t('watchlists.defaultDescription')}
        eyebrow={watchlist.isShared ? t('watchlists.sharedWatchlist') : t('watchlists.privateWatchlist')}
        title={watchlist.name}
      />

      {participants.length > 0 ? (
        <Card className="mb-6 flex flex-wrap items-center gap-3 p-4">
          <span className="text-sm font-semibold text-kino-muted">{t('watchlists.participants')}</span>
          {participants.map((profile) => (
            <span
              className="flex items-center gap-2 rounded-md bg-white/[0.06] px-3 py-2 text-sm text-kino-text"
              key={profile.id}
            >
              <ProfileAvatar profile={profile} size="sm" />
              {profile.display_name || profile.username || t('watchlists.kinoUser')}
            </span>
          ))}
        </Card>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          action={
            <Link className={buttonVariants()} href="/search">
              {t('watchlists.searchTitles')}
            </Link>
          }
          body={t('watchlists.emptyListHint')}
          title={t('watchlists.emptyList')}
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-x-5 gap-y-10 sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]">
          {items.map((item) => (
            <WatchlistTitleCard
              dateFormatter={dateFormatter}
              item={item}
              key={item.id}
              localizedTitles={localizedTitleMap}
              onRemove={() => setRemoveTarget(item)}
              showRemove={user?.id === item.addedBy}
            />
          ))}
        </div>
      )}

      <ConfirmActionDialog
        actionLabel={deleteMutation.isPending ? t('watchlists.deleting') : t('common.delete')}
        description={t('watchlists.deleteWatchlistConfirm')}
        onConfirm={() => deleteMutation.mutate()}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        pending={deleteMutation.isPending}
        title={t('watchlists.deleteWatchlist')}
      />
      <ConfirmActionDialog
        actionLabel={leaveMutation.isPending ? t('watchlists.leaving') : t('watchlists.leave')}
        description={t('watchlists.leaveWatchlistConfirm')}
        onConfirm={() => leaveMutation.mutate()}
        onOpenChange={setLeaveOpen}
        open={leaveOpen}
        pending={leaveMutation.isPending}
        title={t('watchlists.leaveWatchlist')}
      />
      <ConfirmActionDialog
        actionLabel={removeMutation.isPending ? t('common.loading') : t('common.remove')}
        description={t('watchlists.removeFromListConfirm', {
          title: removeTargetTitle,
        })}
        onConfirm={() => (removeTarget ? removeMutation.mutate(removeTarget) : undefined)}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
        open={Boolean(removeTarget)}
        pending={removeMutation.isPending}
        title={t('watchlists.removeFromListTitle')}
      />

      <EditWatchlistDialog
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: detailQueryKey })
          queryClient.invalidateQueries({ queryKey: ['watchlists', user?.id] })
        }}
        open={editOpen}
        watchlist={watchlist}
      />
    </div>
  )
}

function WatchlistTitleCard({
  item,
  showRemove,
  onRemove,
  dateFormatter,
  localizedTitles,
}: {
  item: WatchlistItemDetails
  showRemove: boolean
  onRemove: () => void
  dateFormatter: Intl.DateTimeFormat
  localizedTitles: LocalizedTitleMap
}) {
  const { t } = useTranslation()
  const localized = localizedTitles[localizedTitleKey({ tmdbId: item.title.tmdb_id, type: item.title.type })]
  const displayTitle = localized?.title || item.title.title
  const poster = getTmdb().getImageUrl(localized?.posterPath ?? item.title.cover_image, 'w300')
  const profile = item.addedByUser || {
    avatar_url: null,
    display_name: null,
    username: null,
  }
  const addedBy = profile.display_name || profile.username || t('watchlists.kinoUser')

  return (
    <article className="group min-w-0">
      <div className="relative">
        <Link
          aria-label={displayTitle}
          className="focus-ring block rounded-lg"
          href={`/title/${item.title.tmdb_id}?type=${item.title.type}`}
        >
          <Poster className="rounded-lg shadow-soft" src={poster} title={displayTitle} />
        </Link>
        <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
          <ProfileAvatar profile={profile} size="poster" />
        </div>
        {showRemove ? (
          <button
            aria-label={t('watchlists.removeTitle', { title: displayTitle })}
            className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-black/75 text-white opacity-0 shadow-soft transition hover:bg-red-500/80 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kino-accent group-hover:opacity-100"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onRemove()
            }}
            title={t('watchlists.removeTitle', { title: displayTitle })}
            type="button"
          >
            <Trash2 size={16} />
          </button>
        ) : null}
      </div>
      <div className="min-w-0 pt-7">
        <h2 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-kino-text">{displayTitle}</h2>
        <div className="mt-2 grid gap-1 text-xs text-kino-muted">
          <span>{t('watchlists.addedBy', { name: addedBy })}</span>
          <span>{t('watchlists.addedOn', { date: dateFormatter.format(item.addedAt) })}</span>
        </div>
      </div>
    </article>
  )
}

function ProfileAvatar({
  profile,
  size = 'sm',
}: {
  profile: Pick<UserProfile, 'avatar_url' | 'display_name' | 'username'>
  size?: 'xs' | 'sm' | 'poster'
}) {
  const initials = (profile.display_name || profile.username || 'K')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
  const className =
    size === 'poster'
      ? 'h-10 w-10 rounded-full border-2 border-kino-bg bg-kino-surface shadow-soft'
      : size === 'xs'
        ? 'h-6 w-6 rounded-full'
        : 'h-8 w-8 rounded-full'

  return (
    <Avatar className={className}>
      <AvatarImage alt="" src={profile.avatar_url || undefined} />
      <AvatarFallback className="bg-kino-elevated text-xs">{initials}</AvatarFallback>
    </Avatar>
  )
}

function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  actionLabel: string
  pending: boolean
  onConfirm: () => void
}) {
  const { t } = useTranslation()

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogButtonCancel disabled={pending}>{t('common.cancel')}</AlertDialogButtonCancel>
          <AlertDialogButtonAction disabled={pending} onClick={onConfirm} variant="destructive">
            {actionLabel}
          </AlertDialogButtonAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function EditWatchlistDialog({
  open,
  onClose,
  onSaved,
  watchlist,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  watchlist: Watchlist
}) {
  const { t } = useTranslation()
  const { notify } = useToast()
  const [name, setName] = useState(watchlist.name)
  const [description, setDescription] = useState(watchlist.description || '')
  const [isShared, setIsShared] = useState(watchlist.isShared)
  const mutation = useMutation({
    mutationFn: () =>
      db.updateWatchlist(watchlist.id, {
        name,
        description,
        isShared,
      }),
    onSuccess: () => {
      notify({ tone: 'success', title: t('watchlists.editSaved') })
      onSaved()
      onClose()
    },
    onError: () => notify({ tone: 'error', title: t('common.failedToSave') }),
  })

  useEffect(() => {
    if (open) {
      setName(watchlist.name)
      setDescription(watchlist.description || '')
      setIsShared(watchlist.isShared)
    }
  }, [open, watchlist])

  return (
    <Dialog onClose={onClose} open={open} title={t('modals.editWatchlist')}>
      <div className="grid gap-4">
        <Field label={t('modals.name')} onChange={(event) => setName(event.target.value)} value={name} />
        <TextArea
          label={t('modals.descriptionOptional')}
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
        <label className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-kino-text">
          <input checked={isShared} onChange={(event) => setIsShared(event.target.checked)} type="checkbox" />
          {t('modals.shareHint')}
        </label>
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} tone="secondary">
            {t('common.cancel')}
          </Button>
          <Button disabled={mutation.isPending || !name.trim()} onClick={() => mutation.mutate()}>
            {mutation.isPending ? t('common.loading') : t('modals.saveChanges')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
