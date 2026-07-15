'use client'

import { ChevronDown, LogOut, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTranslation } from '@/lib/i18n'
import { db } from '@/lib/services'
import { useAuthStore } from '@/stores/auth-store'

export function AccountMenu() {
  const user = useAuthStore((state) => state.user)
  const signOut = useAuthStore((state) => state.signOut)
  const router = useRouter()
  const { t } = useTranslation()
  const profile = useQuery({
    queryKey: ['navbar-profile', user?.id],
    queryFn: () => db.getUserProfile(user!.id),
    enabled: Boolean(user),
  })
  const profileUsername = profile.data?.username || user?.user_metadata?.username
  const username = profileUsername || t('accountMenu.userFallback')
  const fallback = String(username).slice(0, 2).toUpperCase()

  async function logout() {
    await signOut()
    router.replace('/')
  }

  return (
    <div className="hidden items-center lg:flex">
      <Button
        aria-label={t('accountMenu.profile')}
        className="h-8 gap-1.5 rounded-r-none px-2"
        disabled={!profileUsername}
        onClick={() => profileUsername && router.push(`/${profileUsername}`)}
        size="sm"
        variant="ghost"
      >
        <Avatar className="size-6 rounded-full">
          <AvatarImage alt="" src={profile.data?.avatar_url || undefined} />
          <AvatarFallback className="text-xs">{fallback}</AvatarFallback>
        </Avatar>

        <span className="hidden max-w-28 truncate text-sm sm:inline">@{username}</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('accountMenu.open')}
              className="h-8 w-6 rounded-l-none px-0"
              size="sm"
              variant="ghost"
            >
              <ChevronDown aria-hidden="true" className="size-3.5" />
            </Button>
          }
        />

        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onSelect={() => router.push('/settings')}>
            <Settings aria-hidden="true" className="size-4" />
            {t('common.settings')}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => void logout()}
          >
            <LogOut aria-hidden="true" className="size-4" />
            {t('settings.logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function useMobileAccountData() {
  const user = useAuthStore((state) => state.user)
  const signOut = useAuthStore((state) => state.signOut)
  const router = useRouter()
  const { t } = useTranslation()
  const profile = useQuery({
    queryKey: ['navbar-profile', user?.id],
    queryFn: () => db.getUserProfile(user!.id),
    enabled: Boolean(user),
  })
  const profileUsername = profile.data?.username || user?.user_metadata?.username
  const username = profileUsername || t('accountMenu.userFallback')
  const fallback = String(username).slice(0, 2).toUpperCase()

  return { fallback, profile, profileUsername, router, signOut, t, username }
}

export function MobileProfileMenuItem() {
  const { fallback, profile, profileUsername, router, username } = useMobileAccountData()

  return (
    <DropdownMenuItem
      className="min-h-12"
      disabled={!profileUsername}
      onSelect={() => profileUsername && router.push(`/${profileUsername}`)}
    >
      <Avatar className="size-8 rounded-full">
        <AvatarImage alt="" src={profile.data?.avatar_url || undefined} />
        <AvatarFallback className="text-xs">{fallback}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate">@{username}</span>
    </DropdownMenuItem>
  )
}

export function MobileAccountActions() {
  const { router, signOut, t } = useMobileAccountData()
  async function logout() {
    await signOut()
    router.replace('/')
  }
  return (
    <>
      <DropdownMenuItem onSelect={() => router.push('/settings')}>
        <Settings aria-hidden="true" className="size-4" />
        {t('common.settings')}
      </DropdownMenuItem>
      <DropdownMenuItem variant="destructive" onSelect={() => void logout()}>
        <LogOut aria-hidden="true" className="size-4" />
        {t('settings.logout')}
      </DropdownMenuItem>
    </>
  )
}
