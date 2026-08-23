'use client'

import { hasAuthenticatedUser } from '@kino/core/auth'
import { Activity, BookOpen, Compass, ListChecks } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useState } from 'react'
import { KinoLogo } from '@/components/kino-logo'
import {
  AccountMenu,
  MobileAccountMenu,
  useAccountProfileIdentity,
} from '@/components/layout/account-menu'
import { AppContainer } from '@/components/layout/app-container'
import { AppFooter } from '@/components/layout/app-footer'
import { HomeSkeleton } from '@/components/skeletons/page-skeletons'
import { buttonVariants } from '@/components/ui/button'
import { useStandaloneShellState } from '@/hooks/use-standalone-shell-state'
import { useTranslation } from '@/lib/localization/i18n'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { GlobalSearch } from '../search/global-search'
import { MobileBottomNav } from './mobile-bottom-nav'
import { shouldShowStandaloneMobileBottomNav } from './mobile-bottom-nav.helpers'

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

function isShellNavItemActive(pathname: string, href: string) {
  return pathname === href || (href !== '/discover' && pathname.startsWith(href))
}

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
  const { standalone, standaloneResolved } = useStandaloneShellState()
  const profileIdentity = useAccountProfileIdentity()

  const [searchOpen, setSearchOpen] = useState(false)

  if (pathname.startsWith('/auth/callback')) {
    return <>{children}</>
  }

  if (pathname === '/') {
    return (
      <>
        <LandingRedirect />
        {children}
      </>
    )
  }

  if (resolution.status === 'resolving' && !hasAuthenticatedUser(resolution)) {
    return (
      <main className="grid min-h-screen place-items-center bg-kino-bg p-6">
        <HomeSkeleton label={t('common.loading')} />
      </main>
    )
  }

  const navItems = user ? authenticatedNavItems : publicNavItems

  const showBrowserHeader = !standaloneResolved || !standalone

  const showStandaloneNav = shouldShowStandaloneMobileBottomNav({
    hasUser: Boolean(user),
    standalone,
    standaloneResolved,
  })

  const showBrowserMobileNav = showBrowserHeader && Boolean(user)

  const showMobileBottomNav = showBrowserMobileNav || showStandaloneNav

  const showAuthenticatedFooter = Boolean(user) && !showStandaloneNav

  return (
    <div
      className={cn(
        'page-shell app-shell flex min-h-screen flex-col bg-kino-bg',
        showMobileBottomNav && 'has-mobile-bottom-nav'
      )}
      data-authenticated={user ? 'true' : 'false'}
      data-standalone-mode={standalone ? 'true' : 'false'}
    >
      {showBrowserHeader ? (
        <header className="app-header hidden lg:block">
          <AppContainer>
            <div className="flex h-16 min-w-0 items-center gap-3">
              <Link
                aria-label="Kino home"
                className="
                  inline-flex shrink-0
                  items-center justify-center
                  transition-opacity
                  hover:opacity-80
                  focus-ring
                "
                href={user ? '/discover' : '/'}
              >
                <KinoLogo priority />
              </Link>

              <nav
                aria-label="Primary"
                className={cn(
                  'hidden shrink-0 items-center lg:flex',
                  'transition-all duration-300',
                  searchOpen ? 'gap-0' : 'gap-1'
                )}
              >
                {navItems.map((item) => {
                  const active = isShellNavItemActive(pathname, item.href)
                  const Icon = item.icon
                  const label = t(item.labelKey)

                  return (
                    <Link
                      aria-label={label}
                      className={cn(
                        'header-link',
                        'transition-all duration-300',
                        searchOpen && 'px-2'
                      )}
                      data-active={active}
                      href={item.href}
                      key={item.href}
                    >
                      <Icon aria-hidden="true" className="shrink-0" size={17} />

                      <span
                        className={cn(
                          'overflow-hidden whitespace-nowrap',
                          'transition-all duration-300',
                          searchOpen ? 'max-w-0 opacity-0' : 'max-w-24 opacity-100'
                        )}
                      >
                        {label}
                      </span>
                    </Link>
                  )
                })}
              </nav>

              <div
                className="
                  ml-auto
                  flex min-w-0 flex-1
                  items-center justify-end
                  gap-2
                "
              >
                <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

                <div className="flex shrink-0 items-center gap-2">
                  {user ? (
                    <>
                      <AccountMenu />

                      {showBrowserMobileNav ? null : <MobileAccountMenu />}
                    </>
                  ) : (
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        className={buttonVariants({
                          size: 'sm',
                          variant: 'ghost',
                        })}
                        href="/auth/login"
                      >
                        {t('landing.nav.signIn')}
                      </Link>

                      <Link
                        className={buttonVariants({
                          size: 'sm',
                          variant: 'default',
                        })}
                        href="/auth/register"
                      >
                        {t('landing.nav.createAccount')}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </AppContainer>
        </header>
      ) : null}

      <main className="page-main flex-1">
        <AppContainer>{children}</AppContainer>
      </main>

      {showAuthenticatedFooter ? <AppFooter /> : null}

      {showMobileBottomNav ? (
        <MobileBottomNav
          profile={profileIdentity}
          searchOpen={searchOpen}
          onSearchOpen={() => setSearchOpen(true)}
          standalone={standalone}
        />
      ) : null}
    </div>
  )
}
