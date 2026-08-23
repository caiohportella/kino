import { isProfileSectionPath } from '../../lib/routes.ts'

export const MOBILE_BOTTOM_NAV_CLASSNAME = `
  fixed left-1/2 z-40 -translate-x-1/2
  w-[min(calc(100vw-24px),28rem)]
  rounded-2xl
  border border-white/10
  bg-kino-surface/95
  shadow-[0_8px_32px_rgb(0_0_0/0.45)]
  backdrop-blur-md
  overflow-hidden
`

export const MOBILE_BOTTOM_NAV_GRID_CLASSNAME = 'grid h-14 px-1'
export const MOBILE_BOTTOM_NAV_BOTTOM_OFFSET = 'calc(env(safe-area-inset-bottom) + 12px)'

export type MobileBottomNavProfile = {
  fallback: string
  profile: {
    data?: {
      avatar_url?: string | null
    } | null
  }
  profileHref: string | null
  profileUsername?: string | null
}

export type MobileBottomNavLabels = {
  activity: string
  diary: string
  home: string
  profile: string
  profileMenu: string
  search: string
  watchlists: string
}

type MobileBottomNavLinkItem = {
  active: boolean
  ariaCurrent: 'page' | undefined
  ariaLabel: string
  href: string
  id: 'discover' | 'activity' | 'diary' | 'watchlists'
  kind: 'link'
  label: string
}

type MobileBottomNavButtonItem = {
  active: boolean
  ariaLabel: string
  id: 'search'
  kind: 'button'
  label: string
}

type MobileBottomNavProfileItem = {
  active: boolean
  ariaCurrent: 'page' | undefined
  ariaLabel: string
  avatarSrc: string | undefined
  fallback: string
  href: string | null
  id: 'profile'
  kind: 'profile'
  label: string
}

export type MobileBottomNavItem =
  | MobileBottomNavLinkItem
  | MobileBottomNavButtonItem
  | MobileBottomNavProfileItem

export function shouldShowStandaloneMobileBottomNav({
  hasUser,
  standalone,
  standaloneResolved,
}: {
  hasUser: boolean
  standalone: boolean
  standaloneResolved: boolean
}) {
  return standaloneResolved && standalone && hasUser
}

export function isMobileBottomNavLinkActive(pathname: string, href: string) {
  if (href === '/discover') {
    return pathname === '/discover'
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function getMobileBottomNavLayout(
  itemCount: number,
  { standalone = true }: { standalone?: boolean } = {}
) {
  return {
    bottomOffset: MOBILE_BOTTOM_NAV_BOTTOM_OFFSET,
    gridClassName: MOBILE_BOTTOM_NAV_GRID_CLASSNAME,
    gridTemplateColumns: `repeat(${itemCount}, minmax(0, 1fr))`,
    navClassName: `${MOBILE_BOTTOM_NAV_CLASSNAME}${standalone ? '' : ' lg:hidden'}`,
  }
}

export function buildMobileBottomNavItems({
  labels,
  pathname,
  profile,
  searchOpen,
}: {
  labels: MobileBottomNavLabels
  pathname: string
  profile: MobileBottomNavProfile
  searchOpen: boolean
}): MobileBottomNavItem[] {
  const items: MobileBottomNavItem[] = [
    {
      active: isMobileBottomNavLinkActive(pathname, '/discover'),
      ariaCurrent: undefined,
      ariaLabel: labels.home,
      href: '/discover',
      id: 'discover',
      kind: 'link',
      label: labels.home,
    },
    {
      active: searchOpen,
      ariaLabel: labels.search,
      id: 'search',
      kind: 'button',
      label: labels.search,
    },
    {
      active: isMobileBottomNavLinkActive(pathname, '/activity'),
      ariaCurrent: undefined,
      ariaLabel: labels.activity,
      href: '/activity',
      id: 'activity',
      kind: 'link',
      label: labels.activity,
    },
    {
      active: isMobileBottomNavLinkActive(pathname, '/diary'),
      ariaCurrent: undefined,
      ariaLabel: labels.diary,
      href: '/diary',
      id: 'diary',
      kind: 'link',
      label: labels.diary,
    },
    {
      active: isMobileBottomNavLinkActive(pathname, '/watchlists'),
      ariaCurrent: undefined,
      ariaLabel: labels.watchlists,
      href: '/watchlists',
      id: 'watchlists',
      kind: 'link',
      label: labels.watchlists,
    },
    {
      active: profile.profileUsername
        ? isProfileSectionPath(pathname, profile.profileUsername)
        : false,
      ariaCurrent: undefined,
      ariaLabel: labels.profileMenu,
      avatarSrc: profile.profile.data?.avatar_url || undefined,
      fallback: profile.fallback,
      href: profile.profileHref,
      id: 'profile',
      kind: 'profile',
      label: labels.profile,
    },
  ]

  for (const item of items) {
    if (item.kind !== 'button') {
      item.ariaCurrent = item.active ? 'page' : undefined
    }
  }

  return items
}
