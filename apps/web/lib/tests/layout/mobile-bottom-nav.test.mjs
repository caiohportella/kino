import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  buildMobileBottomNavItems,
  getMobileBottomNavLayout,
  shouldShowStandaloneMobileBottomNav,
} from '../../../components/layout/mobile-bottom-nav.helpers.ts'

const accountMenuUrl = new URL('../../../components/layout/account-menu.tsx', import.meta.url)
const mobileBottomNavUrl = new URL(
  '../../../components/layout/mobile-bottom-nav.tsx',
  import.meta.url
)
const englishI18nUrl = new URL('../../../../../packages/i18n/generated/en-GB.json', import.meta.url)

const labels = {
  activity: 'Activity',
  diary: 'Diary',
  home: 'Home',
  profile: 'Profile',
  profileMenu: 'Open profile',
  search: 'Search',
  watchlists: 'Watchlists',
}

function createProfile(overrides = {}) {
  return {
    fallback: 'CA',
    profile: {
      data: {
        avatar_url: null,
      },
    },
    profileHref: '/caio',
    profileUsername: 'caio',
    username: 'caio',
    ...overrides,
  }
}

test('standalone mobile bottom nav only shows for authenticated standalone sessions', () => {
  assert.equal(
    shouldShowStandaloneMobileBottomNav({
      hasUser: true,
      standalone: true,
      standaloneResolved: true,
    }),
    true
  )

  for (const options of [
    { hasUser: false, standalone: true, standaloneResolved: true },
    { hasUser: true, standalone: false, standaloneResolved: true },
    { hasUser: true, standalone: true, standaloneResolved: false },
  ]) {
    assert.equal(shouldShowStandaloneMobileBottomNav(options), false)
  }
})

test('mobile bottom nav builds the authenticated six-item layout with the canonical profile destination', () => {
  const items = buildMobileBottomNavItems({
    labels,
    pathname: '/caio/stats/recap/2026/08',
    profile: createProfile({
      profile: {
        data: {
          avatar_url: 'https://cdn.example.com/caio.png',
        },
      },
    }),
    searchOpen: false,
  })

  assert.equal(items.length, 6)
  assert.deepEqual(
    items.map((item) => item.kind),
    ['link', 'button', 'link', 'link', 'link', 'profile']
  )

  const profileItem = items.at(-1)
  assert.ok(profileItem)
  assert.equal(profileItem.kind, 'profile')
  assert.equal(profileItem.href, '/caio')
  assert.equal(profileItem.label, labels.profile)
  assert.equal(profileItem.ariaLabel, labels.profileMenu)
  assert.equal(profileItem.ariaCurrent, 'page')
  assert.equal(profileItem.active, true)
  assert.equal(profileItem.avatarSrc, 'https://cdn.example.com/caio.png')
  assert.equal(profileItem.fallback, 'CA')

  const layout = getMobileBottomNavLayout(items.length)
  assert.match(layout.navClassName, /\bfixed\b/)
  assert.match(layout.navClassName, /\bleft-1\/2\b/)
  assert.match(layout.navClassName, /-translate-x-1\/2/)
  assert.match(layout.navClassName, /\boverflow-hidden\b/)
  assert.doesNotMatch(layout.navClassName, /\blg:hidden\b/)
  assert.equal(layout.bottomOffset, 'calc(env(safe-area-inset-bottom) + 12px)')
  assert.equal(layout.gridClassName, 'grid h-14 px-1')
  assert.equal(layout.gridTemplateColumns, 'repeat(6, minmax(0, 1fr))')
})

test('browser mobile dock is bottom-floating while standalone dock works at every width', () => {
  const browserLayout = getMobileBottomNavLayout(6, { standalone: false })
  const standaloneLayout = getMobileBottomNavLayout(6, { standalone: true })

  assert.match(browserLayout.navClassName, /\blg:hidden\b/)
  assert.doesNotMatch(standaloneLayout.navClassName, /\blg:hidden\b/)
  assert.match(browserLayout.navClassName, /\bfixed\b/)
})

test('mobile bottom nav keeps the profile item inactive for another user and falls back when no avatar exists', () => {
  const items = buildMobileBottomNavItems({
    labels,
    pathname: '/other/stats',
    profile: createProfile(),
    searchOpen: true,
  })

  const searchItem = items[1]
  assert.equal(searchItem.kind, 'button')
  assert.equal(searchItem.active, true)

  const profileItem = items.at(-1)
  assert.ok(profileItem)
  assert.equal(profileItem.kind, 'profile')
  assert.equal(profileItem.active, false)
  assert.equal(profileItem.ariaCurrent, undefined)
  assert.equal(profileItem.avatarSrc, undefined)
  assert.equal(profileItem.fallback, 'CA')
})

test('mobile bottom nav leaves the profile item inactive when the authenticated username is unavailable', () => {
  const items = buildMobileBottomNavItems({
    labels,
    pathname: '/caio/stats',
    profile: createProfile({
      profileHref: null,
      profileUsername: null,
    }),
    searchOpen: false,
  })

  const profileItem = items.at(-1)
  assert.ok(profileItem)
  assert.equal(profileItem.kind, 'profile')
  assert.equal(profileItem.active, false)
  assert.equal(profileItem.ariaCurrent, undefined)
  assert.equal(profileItem.href, null)
})

test('mobile account menu keeps profileHref in the mobile profile row binding', () => {
  const accountMenuSource = readFileSync(accountMenuUrl, 'utf8')

  assert.match(
    accountMenuSource,
    /const\s*\{[\s\S]*profileHref[\s\S]*\}\s*=\s*useMobileAccountData\(\);?/,
    'MobileAccountMenu should keep profileHref in scope for the profile-row click handler'
  )
})

test('mobile bottom nav uses a localized navigation landmark label', () => {
  const mobileBottomNavSource = readFileSync(mobileBottomNavUrl, 'utf8')
  const englishI18n = JSON.parse(readFileSync(englishI18nUrl, 'utf8'))

  assert.match(mobileBottomNavSource, /aria-label=\{t\(['"]common\.navigation['"]\)\}/)
  assert.equal(englishI18n.common.navigation, 'Navigation')
})
