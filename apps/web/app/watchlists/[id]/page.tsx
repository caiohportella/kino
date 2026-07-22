'use client'

import type { UserProfile, Watchlist, WatchlistItemDetails } from '@kino/core'
import { formatDate } from '@kino/core'
import { EmptyState, Poster } from '@/components/kino'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LabeledField as Field, LabeledTextArea as TextArea } from '@/components/ui/labeled-field'
import { ModalDialog as Dialog } from '@/components/ui/modal-dialog'
import { LoaderCircle, Lock, LockOpen, LogOut, Pencil, Save, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { titlePath } from '@/lib/routes'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { WatchlistsSkeleton } from '@/components/skeletons/page-skeletons'
import { PageHeader } from '@/components/page-header'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/components/toast-provider'
import type { LocalizedTitleMap } from '@/lib/use-localized-titles'
import { localizedTitleKey, useLocalizedTitles } from '@/lib/use-localized-titles'
import { db, getTmdb } from '@/lib/services'
import { useTranslation } from '@/lib/i18n'
import { useAuthStore } from '@/stores/auth-store'
import {
  ShareCodeCopyButton,
  ShareCodeDisplay,
  WatchlistSharedBadge,
} from '@/components/watchlist-sharing'

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
  const { t } = useTranslation()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<WatchlistItemDetails | null>(null)
  const detailQueryKey = ['watchlist-detail', params.id] as const

  const query = useQuery<WatchlistDetailData>({
    queryKey: detailQueryKey,
    queryFn: async () => {
      const [watchlist, items] = await Promise.all([
        db.getWatchlist(params.id),
        db.getWatchlistItems(params.id),
      ])
      if (!watchlist) return { watchlist, items, participants: [] }

      const [owner, collaborators] = await Promise.all([
        db.getUserProfile(watchlist.userId),
        db.getWatchlistCollaborators(watchlist.id),
      ])
      const participants = Array.from(
        new Map(
          [owner, ...collaborators]
            .filter((profile): profile is UserProfile => Boolean(profile))
            .map((profile) => [profile.id, profile])
        ).values()
      )

      return { watchlist, items, participants }
    },
  })
  const watchlistItems = query.data?.items || []
  const localizedTitles = useLocalizedTitles(
    watchlistItems.map((item) => ({ tmdbId: item.title.tmdb_id, type: item.title.type }))
  )

  const isOwner = user?.id === query.data?.watchlist?.userId
  const copyText = query.data?.watchlist?.shareCode || ''
  const localizedTitleMap = localizedTitles.data || {}
  const removeTargetTitle = removeTarget
    ? localizedTitleMap[
        localizedTitleKey({ tmdbId: removeTarget.title.tmdb_id, type: removeTarget.title.type })
      ]?.title || removeTarget.title.title
    : t('diary.unknownTitle')

  const removeMutation = useMutation({
    mutationFn: (item: WatchlistItemDetails) => db.removeFromWatchlist(params.id, item.title.id),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: detailQueryKey })
      const previous = queryClient.getQueryData<WatchlistDetailData>(detailQueryKey)
      queryClient.setQueryData<WatchlistDetailData>(detailQueryKey, (current) =>
        current
          ? { ...current, items: current.items.filter((entry) => entry.id !== item.id) }
          : current
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
      queryClient.setQueryData<Watchlist[]>(
        ['watchlists', user?.id],
        (current) => current?.filter((watchlist) => watchlist.id !== params.id) ?? current
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
      queryClient.setQueryData<Watchlist[]>(
        ['watchlists', user?.id],
        (current) => current?.filter((watchlist) => watchlist.id !== params.id) ?? current
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

  if (query.isLoading) return <WatchlistsSkeleton detail label={t('watchlists.loadingWatchlist')} />

  if (!query.data?.watchlist) {
    return (
      <EmptyState
        body={t('watchlists.notFoundBody')}
        illustrationLabel={t('emptyStates.missingIllustration')}
        title={t('watchlists.notFound')}
        variant="missing"
      />
    )
  }

  const { watchlist, items, participants } = query.data

  return (
    <div className="content-frame">
      <PageHeader
        action={
          <div className="flex flex-wrap gap-3">
            {watchlist.isShared && copyText ? <ShareCodeCopyButton code={copyText} showCode /> : null}
            {isOwner ? (
              <>
                <Button onClick={() => setEditOpen(true)} variant="secondary">
                  <Pencil size={16} />
                  {t('watchlists.edit')}
                </Button>
                <Button
                  disabled={deleteMutation.isPending}
                  onClick={() => setDeleteOpen(true)}
                  variant="destructive"
                >
                  <Trash2 size={16} />
                  {deleteMutation.isPending ? t('watchlists.deleting') : t('common.delete')}
                </Button>
              </>
            ) : user ? (
              <Button
                disabled={leaveMutation.isPending}
                onClick={() => setLeaveOpen(true)}
                variant="destructive"
              >
                <LogOut size={16} />
                {leaveMutation.isPending ? t('watchlists.leaving') : t('watchlists.leave')}
              </Button>
            ) : null}
          </div>
        }
        body={watchlist.description || t('watchlists.defaultDescription')}
        eyebrow={
          watchlist.isShared ? t('watchlists.sharedWatchlist') : t('watchlists.privateWatchlist')
        }
        title={watchlist.name}
      />

      {participants.length > 0 ? (
        <Card className="mb-6 w-full min-w-0 max-w-full flex-row flex-wrap items-center gap-3 p-4">
          <span className="text-sm font-semibold text-kino-muted">
            {t('watchlists.participants')}
          </span>
          {participants.map((profile) => (
            <Link
              className={buttonVariants({
                className: 'min-w-0 max-w-full',
                variant: 'secondary',
              })}
              key={profile.id}
              href={`/${profile.username}`}
            >
              <ProfileAvatar profile={profile} size="sm" />
              <span className="min-w-0 truncate">
                {profile.display_name || profile.username || t('watchlists.kinoUser')}
              </span>
            </Link>
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
          illustrationLabel={t('emptyStates.watchlistIllustration')}
          title={t('watchlists.emptyList')}
          variant="watchlist"
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-x-5 gap-y-10 sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]">
          {items.map((item) => (
            <WatchlistTitleCard
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
  localizedTitles,
}: {
  item: WatchlistItemDetails
  showRemove: boolean
  onRemove: () => void
  localizedTitles: LocalizedTitleMap
}) {
  const { t } = useTranslation()
  const localized =
    localizedTitles[localizedTitleKey({ tmdbId: item.title.tmdb_id, type: item.title.type })]
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
          href={titlePath(item.title.tmdb_id, item.title.title, item.title.type)}
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
        <h2 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-kino-text">
          {displayTitle}
        </h2>
        <div className="mt-2 grid gap-1 text-xs text-kino-muted">
          <span>{t('watchlists.addedBy', { name: addedBy })}</span>
          <span>{t('watchlists.addedOn', { date: formatDate(item.addedAt) })}</span>
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
          <AlertDialogCancel disabled={pending}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={onConfirm} variant="destructive">
            {actionLabel}
          </AlertDialogAction>
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
  const queryClient = useQueryClient()
  const [name, setName] = useState(watchlist.name)
  const [description, setDescription] = useState(watchlist.description || '')
  const [isShared, setIsShared] = useState(watchlist.isShared)
  const [shareCode, setShareCode] = useState(watchlist.shareCode || '')
  const mutation = useMutation({
    mutationFn: () =>
      db.updateWatchlist(watchlist.id, {
        name,
        description,
        isShared,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<WatchlistDetailData>(['watchlist-detail', watchlist.id], (current) =>
        current ? { ...current, watchlist: updated } : current
      )
      queryClient.setQueriesData<Watchlist[]>({ queryKey: ['watchlists'] }, (current) =>
        current?.map((item) => item.id === updated.id ? updated : item)
      )
      notify({ tone: 'success', title: t('watchlists.editSaved') })
      onSaved()
      onClose()
    },
    onError: () => notify({ tone: 'error', title: t('common.failedToSave') }),
  })
  const privacyMutation = useMutation({
    mutationFn: (makePublic: boolean) => db.setWatchlistPrivacy(watchlist.id, makePublic),
    onMutate: async (makePublic) => {
      const detailKey = ['watchlist-detail', watchlist.id]
      await Promise.all([
        queryClient.cancelQueries({ queryKey: detailKey }),
        queryClient.cancelQueries({ queryKey: ['watchlists'] }),
      ])
      const previousDetail = queryClient.getQueryData<WatchlistDetailData>(detailKey)
      const previousLists = queryClient.getQueriesData<Watchlist[]>({ queryKey: ['watchlists'] })
      setIsShared(makePublic)
      if (!makePublic) setShareCode('')
      const applyOptimistic = (item: Watchlist) => item.id === watchlist.id
        ? { ...item, isShared: makePublic, shareCode: makePublic ? item.shareCode : undefined }
        : item
      queryClient.setQueryData<WatchlistDetailData>(detailKey, (current) =>
        current?.watchlist
          ? { ...current, watchlist: applyOptimistic(current.watchlist) }
          : current
      )
      queryClient.setQueriesData<Watchlist[]>({ queryKey: ['watchlists'] }, (current) =>
        current?.map(applyOptimistic)
      )
      return { previousDetail, previousLists }
    },
    onSuccess: (updated) => {
      setShareCode(updated.shareCode || '')
      setIsShared(updated.isShared)
      queryClient.setQueryData<WatchlistDetailData>(['watchlist-detail', watchlist.id], (current) =>
        current ? { ...current, watchlist: updated } : current
      )
      queryClient.setQueriesData<Watchlist[]>({ queryKey: ['watchlists'] }, (current) =>
        current?.map((item) => item.id === updated.id ? updated : item)
      )
      queryClient.invalidateQueries({ queryKey: ['watchlist-picker'] })
      notify({
        tone: 'success',
        title: updated.isShared ? t('watchlists.nowPublic') : t('watchlists.nowPrivate'),
      })
    },
    onError: (_error, _makePublic, context) => {
      setIsShared(watchlist.isShared)
      setShareCode(watchlist.shareCode || '')
      if (context?.previousDetail) {
        queryClient.setQueryData(['watchlist-detail', watchlist.id], context.previousDetail)
      }
      for (const [key, data] of context?.previousLists || []) queryClient.setQueryData(key, data)
      notify({ tone: 'error', title: t('watchlists.privacyFailed') })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] })
      queryClient.invalidateQueries({ queryKey: ['watchlist-detail', watchlist.id] })
    },
  })

  useEffect(() => {
    if (open) {
      setName(watchlist.name)
      setDescription(watchlist.description || '')
      setIsShared(watchlist.isShared)
      setShareCode(watchlist.shareCode || '')
    }
  }, [open, watchlist])

  return (
    <Dialog onClose={onClose} open={open} title={t('modals.editWatchlist')}>
      <div className="grid gap-4">
        <Field
          label={t('modals.name')}
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
        <TextArea
          label={t('modals.descriptionOptional')}
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
        <section
          aria-labelledby="watchlist-sharing-title"
          className="grid gap-5 rounded-md border border-border bg-muted/20 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.9fr)] sm:items-start"
        >
          <div className="grid min-w-0 content-start gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-kino-text" id="watchlist-sharing-title">
                {t('watchlists.sharing')}
              </h3>
            </div>
            <p className="text-sm leading-6 text-kino-muted">
              {isShared ? t('watchlists.sharingPublicDescription') : t('watchlists.sharingPrivateDescription')}
            </p>
          </div>

          <div className="grid min-w-0 content-start gap-2 ">
            {isShared && shareCode ? (
              <ShareCodeDisplay code={shareCode} />
            ) : null}
            <Button
              aria-live="polite"
              className="min-h-10 w-full min-w-0 whitespace-normal text-center leading-tight"
              disabled={privacyMutation.isPending}
              onClick={() => privacyMutation.mutate(!isShared)}
              type="button"
              variant="secondary"
            >
              {privacyMutation.isPending ? (
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
              ) : isShared ? (
                <Lock data-icon="inline-start" />
              ) : (
                <LockOpen data-icon="inline-start" />
              )}
              {privacyMutation.isPending
                ? t('watchlists.updatingPrivacy')
                : isShared
                  ? t('watchlists.makePrivate')
                  : t('watchlists.makePublic')}
            </Button>
          </div>
        </section>
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} variant="secondary">
            {t('common.cancel')}
          </Button>
          <Button className="min-w-36" disabled={mutation.isPending || !name.trim()} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            {mutation.isPending ? t('common.loading') : t('modals.saveChanges')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
