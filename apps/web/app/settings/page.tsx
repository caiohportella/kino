'use client'

import type { KinoLanguage } from '@kino/core/locale-config'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Camera,
  Check,
  ChevronDown,
  CloudUpload,
  ImagePlus,
  Languages,
  LogOut,
  Save,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ProtectedContentGate } from '@/components/auth/protected-content-gate'
import { ProtectedEmpty } from '@/components/auth/protected-empty'
import { EmptyState } from '@/components/kino'
import { PageHeader } from '@/components/layout/page-header'
import { BannerPickerDialog } from '@/components/profile/banner-picker-dialog'
import { ProfileStatSummaryCard } from '@/components/profile/profile-stat-summary-card'
import { SettingsSkeleton } from '@/components/skeletons/page-skeletons'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LabeledField as Field, LabeledTextArea as TextArea } from '@/components/ui/labeled-field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useProfileMediaStats, useProfileStats } from '@/hooks/use-profile-stats'
import { useTranslation } from '@/lib/i18n'
import { invalidateProfileMutation } from '@/lib/profile-invalidation'
import { profileStatsPath } from '@/lib/routes'
import { syncCurrentUserSearchProfile } from '@/lib/search/upstash/user-sync-client'
import { db } from '@/lib/services'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'

const languages: {
  code: KinoLanguage
  flag: string
  nativeName: string
  englishName?: string
}[] = [
  {
    code: 'pt',
    flag: '🇧🇷',
    nativeName: 'Português (Brasil)',
    englishName: 'Portuguese',
  },
  { code: 'en', flag: '🇺🇸', nativeName: 'English' },
  { code: 'fr', flag: '🇫🇷', nativeName: 'Français', englishName: 'French' },
  { code: 'it', flag: '🇮🇹', nativeName: 'Italiano', englishName: 'Italian' },
  { code: 'de', flag: '🇩🇪', nativeName: 'Deutsch', englishName: 'German' },
  { code: 'es', flag: '🇪🇸', nativeName: 'Español', englishName: 'Spanish' },
  { code: 'no', flag: '🇳🇴', nativeName: 'Norsk', englishName: 'Norwegian' },
]

export default function SettingsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const resolution = useAuthStore((state) => state.resolution)
  const signOut = useAuthStore((state) => state.signOut)
  const language = useSettingsStore((state) => state.language)
  const setLanguage = useSettingsStore((state) => state.setLanguage)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [bannerUrl, setBannerUrl] = useState('')
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const profileQuery = useQuery({
    queryKey: ['profile-settings', user?.id],
    queryFn: () => db.getUserProfile(user!.id),
    enabled: Boolean(user),
  })
  const statsQuery = useProfileStats(
    user
      ? {
          profileId: user.id,
          service: db,
          visibilityScope: { kind: 'authenticated', userId: user.id },
        }
      : undefined
  )

  const mediaStatsQuery = useProfileMediaStats(
    user
      ? {
          profileId: user.id,
          service: db,
          visibilityScope: {
            kind: 'authenticated',
            userId: user.id,
          },
        }
      : undefined
  )

  useEffect(() => {
    if (!profileQuery.data && user) {
      setUsername(user.email?.split('@')[0] || '')
      return
    }
    if (profileQuery.data) {
      setDisplayName(profileQuery.data.display_name || '')
      setUsername(profileQuery.data.username || user?.email?.split('@')[0] || '')
      setBio(profileQuery.data.bio || '')
      setAvatarUrl(profileQuery.data.avatar_url)
      setBannerUrl(profileQuery.data.banner_url || '')
    }
  }, [profileQuery.data, user])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) return
      const trimmedUsername = username.trim()
      if (trimmedUsername.length < 3) throw new Error(t('settings.usernameMinLength'))
      if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
        throw new Error(t('settings.usernameInvalidChars'))
      }
      const uploadedAvatar = avatarFile ? await db.uploadAvatar(avatarFile, user.id) : avatarUrl
      await db.updateUserProfile(user.id, {
        avatar_url: uploadedAvatar,
        banner_url: bannerUrl.trim() || null,
        bio,
        display_name: displayName,
        username: trimmedUsername,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['profile-settings', user?.id],
      })
      if (user?.id) {
        void invalidateProfileMutation(queryClient, {
          kind: 'identity',
          profileId: user.id,
          visibilityScope: { kind: 'authenticated', userId: user.id },
        })
        void syncCurrentUserSearchProfile('upsert').catch(() => undefined)
      }
      router.push(`/${username.trim()}`)
    },
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : t('common.failedToSave')),
  })

  const deleteDataMutation = useMutation({
    mutationFn: () => db.deleteUserData(),
    onSuccess: () => queryClient.clear(),
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : t('common.failedToDelete')),
  })

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      if (user?.id) {
        await syncCurrentUserSearchProfile('delete').catch(() => undefined)
      }
      await db.deleteUserAccount()
    },
    onSuccess: async () => {
      await signOut()
      queryClient.clear()
      router.replace('/')
    },
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : t('common.failedToDelete')),
  })

  const selectedLanguage = languages.find((item) => item.code === language) ?? languages[0]!
  const currentUsername = profileQuery.data?.username || username

  return (
    <ProtectedContentGate
      authLoadingFallback={<SettingsSkeleton label={t('common.loading')} />}
      emptyFallback={<SettingsSkeleton label={t('common.loading')} />}
      errorFallback={<EmptyState body={t('common.tryAgain')} title={t('common.failed')} />}
      pageLoadingFallback={<SettingsSkeleton label={t('common.loading')} />}
      pageStatus={profileQuery.isPending ? 'loading' : profileQuery.isError ? 'error' : 'content'}
      resolution={resolution}
      unauthenticatedFallback={<ProtectedEmpty />}
    >
      <div className="content-frame pb-24 lg:pb-0">
        <PageHeader
          action={
            <Button
              className="hidden lg:inline-flex"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              <Save size={16} />
              {saveMutation.isPending ? t('common.loading') : t('common.save')}
            </Button>
          }
          eyebrow={t('common.settings')}
          title={t('settings.editProfile')}
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className="min-w-0">
            <Card className="overflow-hidden p-0">
              {/* Banner */}
              <div className="relative h-36 bg-kino-panel sm:h-44">
                {bannerUrl ? (
                  <img alt="" className="h-full w-full object-cover" src={bannerUrl} />
                ) : (
                  <div className="h-full w-full bg-[linear-gradient(120deg,rgb(29_185_84/0.16),rgb(255_255_255/0.05)_48%,rgb(0_0_0/0.22))]" />
                )}

                {/* Banner actions */}
                <div className="absolute right-3 top-3 flex items-center gap-2">
                  <Button
                    className="border-white/15 bg-black/60 text-white backdrop-blur-md hover:bg-black/75"
                    onClick={() => setBannerDialogOpen(true)}
                    size="sm"
                    variant="outline"
                  >
                    <ImagePlus size={15} />
                    <span className="hidden sm:inline">{t('modals.bannerFromGallery')}</span>
                  </Button>

                  {bannerUrl ? (
                    <Button
                      aria-label={t('common.remove')}
                      className="border-white/15 bg-black/60 text-red-300 backdrop-blur-md hover:bg-red-500/15 hover:text-red-200"
                      onClick={() => setBannerUrl('')}
                      size="icon"
                      variant="outline"
                    >
                      <Trash2 size={15} />
                    </Button>
                  ) : null}
                </div>

                {/* Avatar */}
                <div className="absolute -bottom-10 left-5 sm:left-6">
                  <div className="relative h-24 w-24">
                    <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-kino-panel bg-kino-surface shadow-soft">
                      {avatarFile ? (
                        <img
                          alt=""
                          className="h-full w-full object-cover"
                          src={URL.createObjectURL(avatarFile)}
                        />
                      ) : avatarUrl ? (
                        <img alt="" className="h-full w-full object-cover" src={avatarUrl} />
                      ) : (
                        <div className="grid h-full place-items-center text-2xl font-semibold text-kino-muted">
                          {displayName?.trim().charAt(0).toUpperCase() || 'K'}
                        </div>
                      )}
                    </div>

                    <input
                      accept="image/*"
                      className="peer sr-only"
                      id="avatar-upload"
                      onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
                      type="file"
                    />

                    <label
                      aria-label={t('settings.editProfile')}
                      className="absolute -bottom-0.5 -right-0.5 grid size-8 cursor-pointer place-items-center rounded-full border-[3px] border-kino-panel bg-kino-accent text-black transition-transform hover:scale-105 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-kino-accent"
                      htmlFor="avatar-upload"
                    >
                      <Camera size={14} strokeWidth={2.5} />
                    </label>
                  </div>
                </div>
              </div>

              {/* Profile fields */}
              <div className="px-5 pb-5 pt-14 sm:px-6 sm:pb-6">
                <div className="grid gap-4">
                  <Field
                    label={t('settings.displayName')}
                    onChange={(event) => setDisplayName(event.target.value)}
                    value={displayName}
                  />

                  <Field
                    label={t('settings.username')}
                    onChange={(event) => setUsername(event.target.value)}
                    value={username}
                  />

                  <div>
                    <TextArea
                      label={t('settings.bio')}
                      maxLength={160}
                      onChange={(event) => setBio(event.target.value)}
                      value={bio}
                    />

                    <div className="mt-1.5 text-right text-[11px] tabular-nums text-kino-muted">
                      {bio.length} / 160
                    </div>
                  </div>

                  {error ? <p className="text-sm text-red-300">{error}</p> : null}
                </div>
              </div>
            </Card>
          </div>

          <aside className="grid content-start gap-5">
            <ProfileStatSummaryCard
              error={statsQuery.isError || mediaStatsQuery.isError}
              href={profileStatsPath(currentUsername)}
              loading={statsQuery.isPending || mediaStatsQuery.isPending}
              onRetry={() => {
                void statsQuery.refetch()
                void mediaStatsQuery.refetch()
              }}
              stats={statsQuery.data}
              mediaStats={mediaStatsQuery.data}
            />

            <Card className="grid gap-3 p-5">
              <h2 className="text-lg font-semibold text-kino-text">{t('settings.language')}</h2>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      aria-label={t('settings.language')}
                      className="min-h-14 justify-between border-white/10 bg-kino-panel px-4 text-left hover:bg-white/[0.07]"
                      variant="secondary"
                    />
                  }
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Languages className="text-kino-muted" size={18} />
                    <span className="text-xl leading-none" aria-hidden="true">
                      {selectedLanguage.flag}
                    </span>
                    <span className="grid min-w-0 gap-0.5">
                      <span className="truncate text-sm font-semibold text-kino-text">
                        {selectedLanguage.nativeName}
                      </span>
                      {selectedLanguage.englishName ? (
                        <span className="truncate text-xs font-medium text-kino-muted">
                          {selectedLanguage.englishName}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <ChevronDown className="shrink-0 text-kino-muted" size={17} />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[min(340px,calc(100vw-32px))] p-2">
                  <div className="grid gap-1" role="listbox" aria-label={t('settings.language')}>
                    {languages.map((item) => {
                      const active = item.code === language
                      return (
                        <button
                          aria-selected={active}
                          className={`grid min-h-14 grid-cols-[28px_1fr_20px] items-center gap-3 rounded-md px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-kino-accent ${
                            active
                              ? 'bg-kino-accent/15 text-kino-text'
                              : 'text-kino-muted hover:bg-white/6 hover:text-kino-text'
                          }`}
                          key={item.code}
                          onClick={() => setLanguage(item.code)}
                          role="option"
                          type="button"
                        >
                          <span className="text-xl leading-none" aria-hidden="true">
                            {item.flag}
                          </span>
                          <span className="grid min-w-0 gap-0.5">
                            <span className="truncate text-sm font-semibold">
                              {item.nativeName}
                            </span>
                            {item.englishName ? (
                              <span className="truncate text-xs font-medium text-kino-muted">
                                {item.englishName}
                              </span>
                            ) : null}
                          </span>
                          {active ? <Check className="text-kino-accent" size={17} /> : null}
                        </button>
                      )
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </Card>

            <Card className="grid gap-3 p-5">
              <h2 className="text-lg font-semibold text-kino-text">
                {t('importFlow.settingsTitle')}
              </h2>
              <p className="text-sm leading-6 text-kino-muted">
                {t('importFlow.settingsSubtitle')}
              </p>
              <Link href="/import">
                <Button variant="secondary">
                  <CloudUpload size={16} />
                  {t('importFlow.settingsButton')}
                </Button>
              </Link>
            </Card>

            <Card className="grid gap-3 p-5">
              <h2 className="text-lg font-semibold text-kino-text">{t('settings.account')}</h2>
              <Button
                onClick={async () => {
                  await signOut()
                  queryClient.clear()
                  router.replace('/')
                }}
                variant="secondary"
              >
                <LogOut size={16} />
                {t('settings.logout')}
              </Button>
              <Button
                disabled={deleteDataMutation.isPending}
                onClick={() => deleteDataMutation.mutate()}
                variant="destructive"
              >
                <Trash2 size={16} />
                {t('settings.deleteData')}
              </Button>
              <Button
                disabled={deleteAccountMutation.isPending}
                onClick={() => deleteAccountMutation.mutate()}
                variant="destructive"
              >
                <Trash2 size={16} />
                {t('settings.deleteAccount')}
              </Button>
            </Card>
          </aside>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/85 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:hidden">
          <div className="mx-auto max-w-7xl">
            <Button
              className="w-full"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              <Save size={16} />
              {saveMutation.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </div>

        <BannerPickerDialog
          currentBannerUrl={bannerUrl || null}
          onOpenChange={setBannerDialogOpen}
          onSelectBanner={(nextBannerUrl) => setBannerUrl(nextBannerUrl || '')}
          open={bannerDialogOpen}
        />
      </div>
    </ProtectedContentGate>
  )
}
