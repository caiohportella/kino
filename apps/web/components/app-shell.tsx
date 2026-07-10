'use client'

import {
  BookOpen,
  Compass,
  ListChecks,
  Menu,
  Search,
  Settings,
  UserRound,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { useTranslation } from '@/lib/i18n'
import { LoadingPanel } from '@/components/loading-panel'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

const authenticatedNavItems = [
  { href: '/discover', labelKey: 'tabs.home', icon: Compass },
  { href: '/search', labelKey: 'tabs.search', icon: Search },
  { href: '/diary', labelKey: 'tabs.diary', icon: BookOpen },
  { href: '/watchlists', labelKey: 'tabs.watchlists', icon: ListChecks },
]

const publicNavItems = [
  { href: '/discover', labelKey: 'tabs.home', icon: Compass },
  { href: '/search', labelKey: 'tabs.search', icon: Search },
  { href: '/diary', labelKey: 'tabs.diary', icon: BookOpen },
  { href: '/watchlists', labelKey: 'tabs.watchlists', icon: ListChecks },
]

/** Redirects authenticated users from the marketing landing to /discover */
function LandingRedirect() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const loading = useAuthStore((state) => state.loading)

  useEffect(() => {
    if (!loading && user) {
      router.replace('/discover')
    }
  }, [user, loading, router])

  return null
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const user = useAuthStore((state) => state.user)
  const loading = useAuthStore((state) => state.loading)
  const { t } = useTranslation()

  // Auth callback route: render bare
  if (pathname.startsWith('/auth/callback')) {
    return <>{children}</>
  }

  // Root marketing page: render bare (no shell chrome) with landing redirect
  if (pathname === '/') {
    return (
      <>
        <LandingRedirect />
        {children}
      </>
    )
  }

  // While auth resolves, show a loading state
  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-kino-bg p-6">
        <LoadingPanel label={t('common.loading')} />
      </main>
    )
  }

  const navItems = user ? authenticatedNavItems : publicNavItems

  return (
    <div className="page-shell bg-kino-bg">
      <header className="app-header">
        <div className="app-header-inner">
          <Link
            aria-label="Kino home"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] transition-opacity hover:opacity-80 focus-ring"
            href={user ? '/discover' : '/'}
          >
            <img alt="" className="h-7 w-7" src="/icons/icon-192.png" />
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== '/discover' && pathname.startsWith(item.href))
              const Icon = item.icon
              return (
                <Link className="header-link" data-active={active} href={item.href} key={item.href}>
                  <Icon size={17} />
                  {t(item.labelKey)}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <div className="hidden items-center gap-1 sm:flex">
                  <Button asChild size="sm" variant={pathname.startsWith('/settings') ? 'secondary' : 'ghost'}>
                    <Link href="/settings">
                      <Settings size={16} />
                      {t('common.settings')}
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant={pathname.startsWith('/profile') ? 'secondary' : 'ghost'}>
                    <Link href="/profile">
                      <UserRound size={16} />
                      {t('tabs.profile')}
                    </Link>
                  </Button>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-label="Open navigation" className="lg:hidden" size="icon" variant="secondary">
                      <Menu size={18} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {navItems.map((item) => {
                      const active = pathname === item.href || (item.href !== '/discover' && pathname.startsWith(item.href))
                      const Icon = item.icon
                      return (
                        <DropdownMenuItem asChild className={cn(active && 'bg-white/[0.06] text-kino-text')} key={item.href}>
                          <Link href={item.href}>
                            <Icon size={16} />
                            {t(item.labelKey)}
                          </Link>
                        </DropdownMenuItem>
                      )
                    })}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/settings">
                        <Settings size={16} />
                        {t('common.settings')}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/profile">
                        <UserRound size={16} />
                        {t('tabs.profile')}
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="ghost">
                  <Link href="/auth/login">{t('landing.nav.signIn')}</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/auth/register">{t('landing.nav.createAccount')}</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="page-main">{children}</main>
    </div>
  )
}
