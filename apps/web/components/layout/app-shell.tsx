'use client'

import { hasAuthenticatedUser } from '@kino/core/auth'
import { Activity, BookOpen, Compass, ListChecks, Menu, Search } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useState } from 'react'
import { KinoLogo } from '@/components/kino-logo'
import {
  AccountMenu,
  MobileAccountActions,
  MobileProfileMenuItem,
} from '@/components/layout/account-menu'
import { AppFooter } from '@/components/layout/app-footer'
import { HomeSkeleton } from '@/components/skeletons/page-skeletons'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { GlobalSearch } from '../global-search'

const authenticatedNavItems = [
  { href: '/discover', labelKey: 'tabs.home', icon: Compass },
  { href: '/activity', labelKey: 'tabs.activity', icon: Activity },
  { href: '/diary', labelKey: 'tabs.diary', icon: BookOpen },
  { href: '/watchlists', labelKey: 'tabs.watchlists', icon: ListChecks },
]

const publicNavItems = [
  { href: '/discover', labelKey: 'tabs.home', icon: Compass },
  { href: '/diary', labelKey: 'tabs.diary', icon: BookOpen },
  { href: '/watchlists', labelKey: 'tabs.watchlists', icon: ListChecks },
]

/** Redirects authenticated users from the marketing landing to /discover */
function LandingRedirect() {
  const router = useRouter()
  const resolution = useAuthStore((state) => state.resolution)

  useEffect(() => {
    if (hasAuthenticatedUser(resolution)) {
      router.replace('/discover')
    }
  }, [resolution, router])

  return null
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const user = useAuthStore((state) => state.user)
  const resolution = useAuthStore((state) => state.resolution)
  const { t } = useTranslation()

  const [searchOpen, setSearchOpen] = useState(false)

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
  if (resolution.status === 'resolving' && !hasAuthenticatedUser(resolution)) {
    return (
      <main className="grid min-h-screen place-items-center bg-kino-bg p-6">
        <HomeSkeleton label={t('common.loading')} />
      </main>
    )
  }

  const navItems = user ? authenticatedNavItems : publicNavItems

  return (
    <div className="page-shell flex min-h-screen flex-col bg-kino-bg">
      <header className="app-header">
        <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-0">
          <div className={cn(searchOpen && 'hidden lg:block')}>
            <Link
              aria-label="Kino home"
              className="inline-flex h-10 shrink-0 items-center justify-center transition-opacity hover:opacity-80 focus-ring sm:h-11"
              href={user ? '/discover' : '/'}
            >
              <KinoLogo className="h-12 w-auto sm:h-7 lg:h-12" />
            </Link>
          </div>

          <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/discover' && pathname.startsWith(item.href))

              const Icon = item.icon

              return (
                <Link className="header-link" data-active={active} href={item.href} key={item.href}>
                  <Icon size={17} />
                  {t(item.labelKey)}
                </Link>
              )
            })}
          </nav>

          <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

          <div className={cn('ml-auto items-center gap-2', searchOpen ? 'hidden lg:flex' : 'flex')}>
            {user ? (
              <>
                <AccountMenu />

                <Button
                  aria-label={t('tabs.search')}
                  className="lg:hidden"
                  onClick={() => setSearchOpen(true)}
                  size="icon"
                  variant="ghost"
                >
                  <Search size={18} />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        aria-label="Open navigation"
                        className="lg:hidden"
                        size="icon"
                        variant="secondary"
                      >
                        <Menu size={18} />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuGroup>
                      <MobileProfileMenuItem />
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator className="my-2" />
                    <DropdownMenuGroup>
                      {navItems.map((item) => {
                        const active =
                          pathname === item.href ||
                          (item.href !== '/discover' && pathname.startsWith(item.href))
                        const Icon = item.icon
                        return (
                          <DropdownMenuLinkItem
                            closeOnClick
                            render={<Link href={item.href} />}
                            className={cn(active && 'bg-white/6 text-kino-text')}
                            key={item.href}
                          >
                            <Icon size={16} />
                            {t(item.labelKey)}
                          </DropdownMenuLinkItem>
                        )
                      })}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator className="my-2" />
                    <DropdownMenuGroup>
                      <MobileAccountActions />
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/auth/login"
                  className={buttonVariants({
                    size: 'sm',
                    variant: 'ghost',
                  })}
                >
                  {t('landing.nav.signIn')}
                </Link>

                <Link
                  href="/auth/register"
                  className={buttonVariants({
                    size: 'sm',
                    variant: 'default',
                  })}
                >
                  {t('landing.nav.createAccount')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="page-main flex-1">{children}</main>
      {user ? <AppFooter /> : null}
    </div>
  )
}
