import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const appContainerUrl = new URL('../../../components/layout/app-container.tsx', import.meta.url)
const appShellUrl = new URL('../../../components/layout/app-shell.tsx', import.meta.url)
const appFooterUrl = new URL('../../../components/layout/app-footer.tsx', import.meta.url)
const globalsCssUrl = new URL('../../../app/globals.css', import.meta.url)

test('centralizes shell geometry through AppContainer', () => {
  assert.equal(
    existsSync(appContainerUrl),
    true,
    'AppContainer should exist as the shared shell boundary primitive'
  )

  const appContainerSource = readFileSync(appContainerUrl, 'utf8')
  const appShellSource = readFileSync(appShellUrl, 'utf8')
  const appFooterSource = readFileSync(appFooterUrl, 'utf8')
  const globalsCssSource = readFileSync(globalsCssUrl, 'utf8')
  const maxWidthLiteralMatches = globalsCssSource.match(/1320px/g) ?? []

  assert.match(appContainerSource, /export function AppContainer/)
  assert.match(appContainerSource, /max-w-\[var\(--app-shell-max-width\)\]/)
  assert.match(appContainerSource, /px-\[clamp\(16px,2vw,40px\)\]/)
  assert.doesNotMatch(appContainerSource, /1320px/)

  assert.match(
    appShellSource,
    /import \{ AppContainer \} from ['"]@\/components\/layout\/app-container['"];?/
  )
  assert.match(appShellSource, /<AppContainer[\s>]/)
  assert.match(
    appShellSource,
    /<header className="app-header hidden lg:block">[\s\S]*<AppContainer[\s>]/
  )
  assert.match(appShellSource, /<main className="page-main flex-1">[\s\S]*<AppContainer[\s>]/)
  assert.doesNotMatch(appShellSource, /px-\[clamp\(16px,2vw,40px\)\]/)
  assert.doesNotMatch(appShellSource, /app-header-inner/)

  assert.match(
    appFooterSource,
    /import \{ AppContainer \} from '@\/components\/layout\/app-container'/
  )
  assert.match(appFooterSource, /<AppContainer[\s>]/)
  assert.doesNotMatch(appFooterSource, /content-frame flex flex-col gap-4 px-5/)

  assert.equal(maxWidthLiteralMatches.length, 1)
  assert.match(globalsCssSource, /--app-shell-max-width:\s*1320px;/)
  assert.match(
    globalsCssSource,
    /\.landing-section\s*\{[\s\S]*width:\s*min\(100%,\s*var\(--app-shell-max-width\)\);/
  )
  assert.doesNotMatch(globalsCssSource, /width:\s*min\(100%,\s*1320px\);/)
  assert.match(globalsCssSource, /\.page-main\s*\{[\s\S]*padding-block:\s*24px 40px;/)
  assert.doesNotMatch(globalsCssSource, /\.page-main\s*\{[^}]*padding-inline:/s)

  const mobileMediaStart = globalsCssSource.indexOf('@media (max-width: 900px)')
  const mobileMediaEnd = globalsCssSource.indexOf('@media (max-width: 640px)', mobileMediaStart)
  const mobileMediaSource = globalsCssSource.slice(mobileMediaStart, mobileMediaEnd)
  const mobilePageMainMatch = mobileMediaSource.match(/\.page-main\s*\{[\s\S]*?\n\s*\}/)

  assert.ok(mobilePageMainMatch, 'the mobile breakpoint should still define a page-main block')
  assert.match(mobilePageMainMatch[0], /padding-block:\s*18px 40px;/)
  assert.doesNotMatch(mobilePageMainMatch[0], /padding-inline:/)
  assert.doesNotMatch(mobilePageMainMatch[0], /padding:\s*18px;/)
})
