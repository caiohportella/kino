'use client'

import type { KinoLanguage } from '@/stores/settings-store'
import { Button, Card, Field, TextArea } from '@kino/ui'
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
import { useTranslation } from '@/lib/i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BannerPickerDialog } from '@/components/banner-picker-dialog'
import { SettingsSkeleton } from '@/components/skeletons/page-skeletons'
import { PageHeader } from '@/components/page-header'
import { ProtectedEmpty } from '@/components/protected-empty'
import { Button as UiButton } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { db } from '@/lib/services'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'

const languages: {
  code: KinoLanguage
  flag: string
  nativeName: string
  englishName?: string
}[] = [
  { code: 'pt', flag: '🇧🇷', nativeName: 'Português (Brasil)', englishName: 'Portuguese' },
  { code: 'en', flag: '🇺🇸', nativeName: 'English' },
  { code: 'fr', flag: '🇫🇷', nativeName: 'Français', englishName: 'French' },
  { code: 'it', flag: '🇮🇹', nativeName: 'Italiano', englishName: 'Italian' },
  { code: 'no', flag: '🇳🇴', nativeName: 'Norsk', englishName: 'Norwegian' },
]

export default function SettingsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
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
      queryClient.invalidateQueries({ queryKey: ['profile-settings', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
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
    mutationFn: () => db.deleteUserAccount(),
    onSuccess: async () => {
      await signOut()
      queryClient.clear()
      router.replace('/')
    },
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : t('common.failedToDelete')),
  })

  if (!user) {
    return <ProtectedEmpty />
  }

  if (profileQuery.isLoading) return <SettingsSkeleton label={t('common.loading')} />

  const selectedLanguage = languages.find((item) => item.code === language) ?? languages[0]!

  return (
    <div className="content-frame">
      <PageHeader
        action={
          <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            <Save size={16} />
            {saveMutation.isPending ? t('common.loading') : t('common.save')}
          </Button>
        }
        eyebrow={t('common.settings')}
        title={t('settings.editProfile')}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="grid gap-5 p-5">
          <div className="grid gap-4 md:grid-cols-[112px_1fr] md:items-end">
            <div className="relative h-28 w-28">
              <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full border border-white/10 bg-kino-surface shadow-soft">
                {avatarFile ? (
                  <img
                    alt=""
                    className="h-full w-full object-cover"
                    src={URL.createObjectURL(avatarFile)}
                  />
                ) : avatarUrl ? (
                  <img alt="" className="h-full w-full object-cover" src={avatarUrl} />
                ) : (
                  <span className="text-3xl font-semibold text-kino-muted">K</span>
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
                aria-label="Edit profile picture"
                className="absolute bottom-1 right-1 grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-white/20 bg-black/75 text-white shadow-[0_8px_24px_rgb(0_0_0_/_0.35)] transition duration-200 hover:scale-105 hover:bg-black/90 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-kino-accent"
                htmlFor="avatar-upload"
                title="Edit profile picture"
              >
                <Camera size={17} />
              </label>
            </div>

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
            </div>
          </div>

          <TextArea
            label={t('settings.bio')}
            onChange={(event) => setBio(event.target.value)}
            value={bio}
          />
          <section className="grid gap-3">
            <div>
              <h2 className="text-sm font-semibold text-kino-text">{t('modals.selectBanner')}</h2>
              <p className="mt-1 text-xs text-kino-muted">{t('settings.tapToSetBanner')}</p>
            </div>
            <div className="aspect-[5/2] overflow-hidden rounded-md border border-white/10 bg-kino-panel">
              {bannerUrl ? (
                <img alt="" className="h-full w-full object-cover" src={bannerUrl} />
              ) : (
                <div className="grid h-full place-items-center bg-[linear-gradient(135deg,rgb(29_185_84_/_0.16),rgb(255_255_255_/_0.05)_45%,rgb(0_0_0_/_0.18))] text-sm font-semibold text-kino-muted">
                  {t('settings.tapToSetBanner')}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setBannerDialogOpen(true)} tone="secondary">
                <ImagePlus size={16} />
                {t('modals.bannerFromGallery')}
              </Button>
              {bannerUrl ? (
                <Button onClick={() => setBannerUrl('')} tone="ghost">
                  <Trash2 size={16} />
                  {t('common.remove')}
                </Button>
              ) : null}
            </div>
          </section>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
        </Card>

        <aside className="grid content-start gap-5">
          <Card className="grid gap-3 p-5">
            <h2 className="text-lg font-semibold text-kino-text">{t('settings.language')}</h2>
            <Popover>
              <PopoverTrigger
                render={
                  <UiButton
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
                        className={`grid min-h-14 grid-cols-[28px_1fr_20px] items-center gap-3 rounded-md px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kino-accent ${
                          active
                            ? 'bg-kino-accent/15 text-kino-text'
                            : 'text-kino-muted hover:bg-white/[0.06] hover:text-kino-text'
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
                          <span className="truncate text-sm font-semibold">{item.nativeName}</span>
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
              {t('settings.importHistoryTitle')}
            </h2>
            <p className="text-sm leading-6 text-kino-muted">
              {t('settings.importHistorySubtitle')}
            </p>
            <Link href="/import">
              <Button tone="secondary">
                <CloudUpload size={16} />
                {t('settings.import')}
              </Button>
            </Link>
          </Card>

          <Card className="grid gap-3 p-5">
            <h2 className="text-lg font-semibold text-kino-text">{t('profile.title')}</h2>
            <Button
              onClick={async () => {
                await signOut()
                queryClient.clear()
                router.replace('/')
              }}
              tone="secondary"
            >
              <LogOut size={16} />
              {t('settings.logout')}
            </Button>
            <Button
              disabled={deleteDataMutation.isPending}
              onClick={() => deleteDataMutation.mutate()}
              tone="danger"
            >
              <Trash2 size={16} />
              {t('settings.deleteData')}
            </Button>
            <Button
              disabled={deleteAccountMutation.isPending}
              onClick={() => deleteAccountMutation.mutate()}
              tone="danger"
            >
              {t('settings.deleteAccount')}
            </Button>
          </Card>
        </aside>
      </div>

      <BannerPickerDialog
        currentBannerUrl={bannerUrl || null}
        onOpenChange={setBannerDialogOpen}
        onSelectBanner={(nextBannerUrl) => setBannerUrl(nextBannerUrl || '')}
        open={bannerDialogOpen}
      />
    </div>
  )
}
