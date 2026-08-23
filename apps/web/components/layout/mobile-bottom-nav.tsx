'use client'

import { Activity, BookOpen, Compass, ListChecks, Search } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type AccountProfileIdentity } from '@/components/layout/account-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useTranslation } from '@/lib/localization/i18n'
import { cn } from '@/lib/utils'
import { buildMobileBottomNavItems, getMobileBottomNavLayout } from './mobile-bottom-nav.helpers'

type MobileBottomNavProps = {
  profile: AccountProfileIdentity
  searchOpen: boolean
  onSearchOpen: () => void
  standalone: boolean
}

export function MobileBottomNav({
  profile,
  searchOpen,
  onSearchOpen,
  standalone,
}: MobileBottomNavProps) {
  const pathname = usePathname()
  const { t } = useTranslation()
  const items = buildMobileBottomNavItems({
    labels: {
      activity: t('tabs.activity'),
      diary: t('tabs.diary'),
      home: t('tabs.home'),
      profile: t('tabs.profile'),
      profileMenu: t('accountMenu.profile'),
      search: t('tabs.search'),
      watchlists: t('tabs.watchlists'),
    },
    pathname,
    profile,
    searchOpen,
  })
  const layout = getMobileBottomNavLayout(items.length, { standalone })
  const iconById = {
    activity: Activity,
    diary: BookOpen,
    discover: Compass,
    search: Search,
    watchlists: ListChecks,
  }

  return (
    <nav
      aria-label={t('common.navigation')}
      className={layout.navClassName}
      style={{
        bottom: layout.bottomOffset,
      }}
    >
      <div
        className={layout.gridClassName}
        style={{ gridTemplateColumns: layout.gridTemplateColumns }}
      >
        {items.map((item) => {
          if (item.kind === 'button') {
            return (
              <BottomNavButton
                active={item.active}
                ariaLabel={item.ariaLabel}
                icon={iconById[item.id]}
                key={item.id}
                label={item.label}
                onClick={onSearchOpen}
              />
            )
          }

          if (item.kind === 'profile') {
            return (
              <BottomNavProfile
                active={item.active}
                ariaCurrent={item.ariaCurrent}
                ariaLabel={item.ariaLabel}
                avatarSrc={item.avatarSrc}
                fallback={item.fallback}
                href={item.href}
                key={item.id}
                label={item.label}
              />
            )
          }

          return (
            <BottomNavLink
              active={item.active}
              ariaCurrent={item.ariaCurrent}
              ariaLabel={item.ariaLabel}
              href={item.href}
              icon={iconById[item.id]}
              key={item.id}
              label={item.label}
            />
          )
        })}
      </div>
    </nav>
  )
}

function BottomNavLink({
  active,
  ariaCurrent,
  ariaLabel,
  href,
  icon: Icon,
  label,
}: {
  active: boolean
  ariaCurrent?: 'page'
  ariaLabel: string
  href: string
  icon: typeof Compass
  label: string
}) {
  return (
    <Link
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      className={cn(
        'relative flex min-w-0 touch-manipulation items-center justify-center',
        'rounded-xl',
        'transition-[color,transform,opacity] duration-200',
        'ease-[cubic-bezier(0.22,1,0.36,1)]',
        'active:scale-[0.9]',
        'focus-ring',
        active ? 'scale-[1.06] text-kino-accent' : 'text-kino-muted opacity-70'
      )}
      href={href}
    >
      <Icon aria-hidden="true" className="size-5.25" strokeWidth={active ? 2.4 : 2} />

      <span className="sr-only">{label}</span>
    </Link>
  )
}

function BottomNavButton({
  active,
  ariaLabel,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  ariaLabel: string
  icon: typeof Search
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-label={ariaLabel}
      className={cn(
        'relative flex min-w-0 touch-manipulation items-center justify-center',
        'rounded-xl',
        'transition-[color,transform,opacity] duration-200',
        'ease-[cubic-bezier(0.22,1,0.36,1)]',
        'active:scale-[0.9]',
        'focus-ring',
        active ? 'scale-[1.06] text-kino-accent' : 'text-kino-muted opacity-70'
      )}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="size-5.25" strokeWidth={active ? 2.4 : 2} />

      <span className="sr-only">{label}</span>
    </button>
  )
}

function BottomNavProfile({
  active,
  ariaCurrent,
  ariaLabel,
  avatarSrc,
  fallback,
  href,
  label,
}: {
  active: boolean
  ariaCurrent?: 'page'
  ariaLabel: string
  avatarSrc: string | undefined
  fallback: string
  href: string | null
  label: string
}) {
  const content = (
    <>
      <Avatar
        className={cn(
          'size-5.5 rounded-full transition-transform duration-200',
          active && 'scale-[1.06]'
        )}
      >
        <AvatarImage alt="" src={avatarSrc} />
        <AvatarFallback className="text-[9px] font-medium">{fallback}</AvatarFallback>
      </Avatar>

      <span className="sr-only">{label}</span>
    </>
  )

  if (!href) {
    return (
      <span
        aria-disabled="true"
        aria-label={ariaLabel}
        className={cn(
          'relative flex min-w-0 touch-manipulation items-center justify-center',
          'rounded-xl',
          'text-kino-muted opacity-70'
        )}
      >
        {content}
      </span>
    )
  }

  return (
    <Link
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      className={cn(
        'relative flex min-w-0 touch-manipulation items-center justify-center',
        'rounded-xl',
        'transition-[color,transform,opacity] duration-200',
        'ease-[cubic-bezier(0.22,1,0.36,1)]',
        'active:scale-[0.9]',
        'focus-ring',
        active ? 'text-kino-accent' : 'text-kino-muted opacity-70'
      )}
      href={href}
    >
      {content}
    </Link>
  )
}
