'use client'

import { useQuery } from '@tanstack/react-query'
import { ChevronDown, LogOut, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
    <div className="hidden lg:block">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('accountMenu.open')}
              className="
                group h-9 gap-2 rounded-full border border-transparent
                bg-transparent px-2
                hover:border-border/60 hover:bg-white/5
                data-[state=open]:border-border/60
                data-[state=open]:bg-white/5
              "
              size="sm"
              variant="ghost"
            >
              <Avatar className="size-7 rounded-full">
                <AvatarImage alt="" src={profile.data?.avatar_url || undefined} />
                <AvatarFallback className="text-[11px] font-medium">{fallback}</AvatarFallback>
              </Avatar>

              <span className="max-w-28 truncate text-sm font-medium">{username}</span>

              <ChevronDown
                aria-hidden="true"
                className="
                  size-3.5 text-muted-foreground
                  transition-transform duration-200
                  group-data-[state=open]:rotate-180
                "
              />
            </Button>
          }
        />

        <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
          <DropdownMenuGroup>
            {/*
              This used to be a <DropdownMenuLabel> wrapping a plain <button>.
              Labels are presentational only — they carry no selection semantics,
              so a button nested inside one never triggers the menu's built-in
              close-on-select behavior. Using DropdownMenuItem directly (same as
              MobileProfileMenuItem below) fixes that.
            */}
            <DropdownMenuItem
              className="h-auto items-center gap-2.5 py-2"
              disabled={!profileUsername}
              onClick={() => profileUsername && router.push(`/${profileUsername}`)}
            >
              <Avatar className="size-9">
                <AvatarImage alt="" src={profile.data?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">{fallback}</AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-kino-accent">@{username}</p>

                {profile.data?.display_name && (
                  <p className="truncate text-xs text-muted-foreground">
                    {profile.data.display_name}
                  </p>
                )}
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings aria-hidden="true" className="size-4" />
              {t('common.settings')}
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => void logout()}
              className="
                text-destructive
                data-highlighted:bg-destructive/10
                data-highlighted:text-destructive
                focus:bg-destructive/10
                focus:text-destructive
              "
            >
              <LogOut aria-hidden="true" className="size-4 text-destructive" />
              {t('settings.logout')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
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

  return {
    fallback,
    profile,
    profileUsername,
    router,
    signOut,
    t,
    username,
  }
}

export function MobileProfileMenuItem() {
  const { fallback, profile, profileUsername, router, username } = useMobileAccountData()

  return (
    <DropdownMenuItem
      className="min-h-12"
      disabled={!profileUsername}
      onClick={() => profileUsername && router.push(`/${profileUsername}`)}
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
      <DropdownMenuItem onClick={() => router.push('/settings')}>
        <Settings aria-hidden="true" className="size-4" />
        {t('common.settings')}
      </DropdownMenuItem>

      <DropdownMenuItem
        variant="destructive"
        className="text-destructive focus:text-destructive"
        onClick={() => void logout()}
      >
        <LogOut aria-hidden="true" className="size-4" />
        {t('settings.logout')}
      </DropdownMenuItem>
    </>
  )
}
