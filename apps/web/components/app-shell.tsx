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
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { useTranslation } from '@/lib/i18n'
import { LoadingPanel } from '@/components/loading-panel'
import { PublicLanding } from '@/components/public-landing'
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

const navItems = [
  { href: '/', labelKey: 'tabs.home', icon: Compass },
  { href: '/search', labelKey: 'tabs.search', icon: Search },
  { href: '/diary', labelKey: 'tabs.diary', icon: BookOpen },
  { href: '/watchlists', labelKey: 'tabs.watchlists', icon: ListChecks },
]

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const user = useAuthStore((state) => state.user)
  const loading = useAuthStore((state) => state.loading)
  const { t } = useTranslation()

  if (pathname.startsWith('/auth/callback')) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-kino-bg p-6">
        <LoadingPanel label={t('common.loading')} />
      </main>
    )
  }

  if (!user) {
    return <PublicLanding />
  }

  return (
    <div className="page-shell bg-kino-bg">
      <header className="app-header">
        <div className="app-header-inner">
          <Link className="text-xl font-semibold tracking-normal text-kino-text" href="/">
            Kino
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
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
                  const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
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
          </div>
        </div>
      </header>

      <main className="page-main">{children}</main>
    </div>
  )
}
