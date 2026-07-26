'use client'

import type { UserProfile, Watchlist, WatchlistItemDetails, WatchlistVisibility } from '@kino/core'
import { formatDate } from '@kino/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle, LogOut, Pencil, Save, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { EmptyState, Poster } from '@/components/kino'
import { PageHeader } from '@/components/page-header'
import { ShareButton } from '@/components/share-button'
import { WatchlistsSkeleton } from '@/components/skeletons/page-skeletons'
import { useToast } from '@/components/toast-provider'
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
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LabeledField as Field, LabeledTextArea as TextArea } from '@/components/ui/labeled-field'
import { ModalDialog as Dialog } from '@/components/ui/modal-dialog'
import { ShareCodeDisplay } from '@/components/watchlist-sharing'
import { WatchlistVisibilitySelector } from '@/components/watchlist-visibility-selector'
import { useTranslation } from '@/lib/i18n'
import { parseWatchlistSegment, titlePath, watchlistPath } from '@/lib/routes'
import { db, getTmdb } from '@/lib/services'
import { publishWatchlistChange } from '@/lib/watchlist-cache-sync'
import type { LocalizedTitleMap } from '@/lib/use-localized-titles'
import { localizedTitleKey, useLocalizedTitles } from '@/lib/use-localized-titles'
import { useAuthStore } from '@/stores/auth-store'

interface WatchlistDetailData {
  watchlist: Watchlist | null
  items: WatchlistItemDetails[]
  participants: UserProfile[]
  canEdit: boolean
  isOwner: boolean
}

export default function WatchlistDetailPage() {
  const params = useParams<{ id: string }>()
  const watchlistId = parseWatchlistSegment(params.id).id
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const { t } = useTranslation()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<WatchlistItemDetails | null>(null)
  const detailQueryKey = ['watchlist-detail', watchlistId] as const

  const query = useQuery<WatchlistDetailData>({
    queryKey: detailQueryKey,
    queryFn: async () => {
      const [watchlist, items, access] = await Promise.all([
        db.getWatchlist(watchlistId),
        db.getWatchlistItems(watchlistId),
        db.getWatchlistAccess(watchlistId),
      ])
      if (!watchlist) return { watchlist, items, participants: [], ...access }

      const [owner, collaborators] = await Promise.all([
        db.getUserProfile(watchlist.userId),
        db.getWatchlistCollaborators(watchlist.id).catch(() => []),
      ])
      const participants = Array.from(
        new Map(
          [owner, ...collaborators]
            .filter((profile): profile is UserProfile => Boolean(profile))
            .map((profile) => [profile.id, profile])
        ).values()
      )

      return { watchlist, items, participants, ...access }
    },
  })
  const watchlistItems = query.data?.items || []
  const localizedTitles = useLocalizedTitles(
    watchlistItems.map((item) => ({ tmdbId: item.title.tmdb_id, type: item.title.type }))
  )

  const isOwner = query.data?.isOwner || false
  const canEdit = query.data?.canEdit || false
  const copyText = query.data?.watchlist?.shareCode || ''
  const localizedTitleMap = localizedTitles.data || {}
  const removeTargetTitle = removeTarget
    ? localizedTitleMap[
        localizedTitleKey({ tmdbId: removeTarget.title.tmdb_id, type: removeTarget.title.type })
      ]?.title || removeTarget.title.title
    : t('diary.unknownTitle')

  useEffect(() => {
    const watchlist = query.data?.watchlist
    if (!watchlist || watchlist.visibility !== 'public') return
    const canonical = watchlistPath(watchlist.id, watchlist.name)
    if (canonical !== `/watchlists/${params.id}`) router.replace(canonical)
  }, [params.id, query.data?.watchlist, router])

  const removeMutation = useMutation({
    mutationFn: (item: WatchlistItemDetails) => db.removeFromWatchlist(watchlistId, item.title.id),
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
      publishWatchlistChange(watchlistId)
      notify({ tone: 'success', title: t('watchlists.itemRemoved') })
      setRemoveTarget(null)
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: detailQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['public-watchlists'] }),
      ]),
  })

  const deleteMutation = useMutation({
    mutationFn: () => db.deleteWatchlist(watchlistId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['watchlists', user?.id] })
      const previous = queryClient.getQueryData<Watchlist[]>(['watchlists', user?.id])
      queryClient.setQueryData<Watchlist[]>(
        ['watchlists', user?.id],
        (current) => current?.filter((watchlist) => watchlist.id !== watchlistId) ?? current
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(['watchlists', user?.id], context.previous)
      notify({ tone: 'error', title: t('watchlists.failedToDeleteWatchlist') })
    },
    onSuccess: () => {
      publishWatchlistChange(watchlistId)
      notify({ tone: 'success', title: t('watchlists.deleted') })
      queryClient.removeQueries({ queryKey: detailQueryKey })
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['watchlists', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['public-watchlists'] }),
      ])
      router.replace('/watchlists')
    },
  })

  const leaveMutation = useMutation({
    mutationFn: () => db.leaveWatchlist(watchlistId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['watchlists', user?.id] })
      const previous = queryClient.getQueryData<Watchlist[]>(['watchlists', user?.id])
      queryClient.setQueryData<Watchlist[]>(
        ['watchlists', user?.id],
        (current) => current?.filter((watchlist) => watchlist.id !== watchlistId) ?? current
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
  const isParticipant = Boolean(
    user?.id && !isOwner && participants.some((participant) => participant.id === user.id)
  )

  return (
    <div className="content-frame">
      <PageHeader
        action={
          <div className="flex flex-wrap gap-3">
            {watchlist.visibility === 'shared' && copyText ? (
              <ShareButton
                text={t('sharing.watchlistText', { title: watchlist.name })}
                title={watchlist.name}
                url={`/watchlists/shared/${encodeURIComponent(copyText)}`}
              />
            ) : null}
            {watchlist.visibility === 'public' ? (
              <ShareButton
                text={t('sharing.watchlistText', { title: watchlist.name })}
                title={watchlist.name}
                url={watchlistPath(watchlist.id, watchlist.name)}
              />
            ) : null}
            {canEdit ? (
              <>
                <Button onClick={() => setEditOpen(true)} variant="secondary">
                  <Pencil size={16} />
                  {t('watchlists.edit')}
                </Button>
                {isOwner ? (
                  <Button
                    disabled={deleteMutation.isPending}
                    onClick={() => setDeleteOpen(true)}
                    variant="destructive"
                  >
                    <Trash2 size={16} />
                    {deleteMutation.isPending ? t('watchlists.deleting') : t('common.delete')}
                  </Button>
                ) : null}
              </>
            ) : isParticipant ? (
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
        eyebrow={t(`watchlists.visibilityLabels.${watchlist.visibility}`)}
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
              showRemove={canEdit}
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
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: detailQueryKey }),
            queryClient.invalidateQueries({ queryKey: ['watchlists', user?.id] }),
            queryClient.invalidateQueries({ queryKey: ['profile'] }),
            queryClient.invalidateQueries({ queryKey: ['public-watchlists'] }),
          ])
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
  const [visibility, setVisibility] = useState<WatchlistVisibility>(watchlist.visibility)
  const [shareCode, setShareCode] = useState(watchlist.shareCode || '')
  const mutation = useMutation({
    mutationFn: () =>
      db.updateWatchlist(watchlist.id, {
        name,
        description,
      }),
    onSuccess: (updated) => {
      publishWatchlistChange(updated.id)
      queryClient.setQueryData<WatchlistDetailData>(
        ['watchlist-detail', watchlist.id],
        (current) => (current ? { ...current, watchlist: updated } : current)
      )
      queryClient.setQueriesData<Watchlist[]>({ queryKey: ['watchlists'] }, (current) =>
        current?.map((item) => (item.id === updated.id ? updated : item))
      )
      notify({ tone: 'success', title: t('watchlists.editSaved') })
      onSaved()
      onClose()
    },
    onError: () => notify({ tone: 'error', title: t('common.failedToSave') }),
  })
  const visibilityMutation = useMutation({
    mutationFn: (nextVisibility: WatchlistVisibility) =>
      db.setWatchlistVisibility(watchlist.id, nextVisibility),
    onMutate: async (nextVisibility) => {
      const detailKey = ['watchlist-detail', watchlist.id]
      await Promise.all([
        queryClient.cancelQueries({ queryKey: detailKey }),
        queryClient.cancelQueries({ queryKey: ['watchlists'] }),
      ])
      const previousDetail = queryClient.getQueryData<WatchlistDetailData>(detailKey)
      const previousLists = queryClient.getQueriesData<Watchlist[]>({ queryKey: ['watchlists'] })
      setVisibility(nextVisibility)
      if (nextVisibility !== 'shared') setShareCode('')
      const applyOptimistic = (item: Watchlist) =>
        item.id === watchlist.id
          ? {
              ...item,
              visibility: nextVisibility,
              isShared: nextVisibility === 'shared',
              shareCode: nextVisibility === 'shared' ? item.shareCode : undefined,
            }
          : item
      queryClient.setQueryData<WatchlistDetailData>(detailKey, (current) =>
        current?.watchlist ? { ...current, watchlist: applyOptimistic(current.watchlist) } : current
      )
      queryClient.setQueriesData<Watchlist[]>({ queryKey: ['watchlists'] }, (current) =>
        current?.map(applyOptimistic)
      )
      return { previousDetail, previousLists }
    },
    onSuccess: (updated) => {
      publishWatchlistChange(updated.id)
      setShareCode(updated.shareCode || '')
      setVisibility(updated.visibility)
      queryClient.setQueryData<WatchlistDetailData>(
        ['watchlist-detail', watchlist.id],
        (current) => (current ? { ...current, watchlist: updated } : current)
      )
      queryClient.setQueriesData<Watchlist[]>({ queryKey: ['watchlists'] }, (current) =>
        current?.map((item) => (item.id === updated.id ? updated : item))
      )
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['watchlist-picker'] }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['public-watchlists'] }),
      ])
      notify({
        tone: 'success',
        title: t('watchlists.visibilityUpdated'),
      })
    },
    onError: (_error, _nextVisibility, context) => {
      setVisibility(watchlist.visibility)
      setShareCode(watchlist.shareCode || '')
      if (context?.previousDetail) {
        queryClient.setQueryData(['watchlist-detail', watchlist.id], context.previousDetail)
      }
      for (const [key, data] of context?.previousLists || []) queryClient.setQueryData(key, data)
      notify({ tone: 'error', title: t('watchlists.visibilityFailed') })
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
      setVisibility(watchlist.visibility)
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
        <section className="grid gap-3 rounded-md border border-border bg-muted/20 p-4">
          <WatchlistVisibilitySelector
            disabled={visibilityMutation.isPending}
            onChange={(nextVisibility) => visibilityMutation.mutate(nextVisibility)}
            value={visibility}
          />
          {visibility === 'shared' && shareCode ? <ShareCodeDisplay code={shareCode} /> : null}
        </section>
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} variant="secondary">
            {t('common.cancel')}
          </Button>
          <Button
            className="min-w-36"
            disabled={mutation.isPending || !name.trim()}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <Save data-icon="inline-start" />
            )}
            {mutation.isPending ? t('common.loading') : t('modals.saveChanges')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
