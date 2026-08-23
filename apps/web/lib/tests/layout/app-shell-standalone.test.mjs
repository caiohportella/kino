import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const rootLayoutUrl = new URL('../../../app/layout.tsx', import.meta.url)
const appShellUrl = new URL('../../../components/layout/app-shell.tsx', import.meta.url)
const globalsCssUrl = new URL('../../../app/globals.css', import.meta.url)
const standaloneBridgeUrl = new URL('../../../lib/standalone-mode-bridge.ts', import.meta.url)
const standaloneShellStateUrl = new URL(
  '../../../hooks/use-standalone-shell-state.ts',
  import.meta.url
)

test('standalone shell uses a bootstrap bridge and conditional chrome rendering', () => {
  assert.equal(
    existsSync(standaloneBridgeUrl),
    true,
    'the standalone bootstrap bridge helper should exist'
  )

  assert.equal(
    existsSync(standaloneShellStateUrl),
    true,
    'the shell should expose a client-only standalone shell state helper'
  )

  const rootLayoutSource = readFileSync(rootLayoutUrl, 'utf8')
  const appShellSource = readFileSync(appShellUrl, 'utf8')
  const globalsCssSource = readFileSync(globalsCssUrl, 'utf8')
  const standaloneBridgeSource = readFileSync(standaloneBridgeUrl, 'utf8')
  const standaloneShellStateSource = readFileSync(standaloneShellStateUrl, 'utf8')

  /*
   * Root bootstrap
   */

  assert.match(
    rootLayoutSource,
    /getStandaloneModeBootstrapScript/,
    'root layout should include the standalone bootstrap bridge'
  )

  assert.match(rootLayoutSource, /dangerouslySetInnerHTML/)

  /*
   * Standalone-mode bridge
   */

  assert.match(standaloneBridgeSource, /window\.matchMedia\(/)
  assert.match(standaloneBridgeSource, /STANDALONE_MODE_MEDIA_QUERY/)
  assert.match(standaloneBridgeSource, /navigator\.standalone/)

  assert.match(standaloneBridgeSource, /document\.documentElement\.setAttribute\(/)

  assert.match(standaloneBridgeSource, /STANDALONE_MODE_ATTRIBUTE/)
  assert.match(standaloneBridgeSource, /readStandaloneModeAttribute/)

  /*
   * Client shell state
   */

  assert.match(standaloneShellStateSource, /useLayoutEffect/)
  assert.match(standaloneShellStateSource, /readStandaloneModeAttribute/)

  assert.match(
    standaloneShellStateSource,
    /const\s+\[standaloneResolved,\s*setStandaloneResolved\]\s*=\s*useState\(false\);?/
  )

  assert.match(
    standaloneShellStateSource,
    /const\s+\[bootstrappedStandalone,\s*setBootstrappedStandalone\]\s*=\s*useState\(false\);?/
  )

  assert.match(
    standaloneShellStateSource,
    /standalone:\s*standaloneResolved\s*\?\s*runtimeStandalone\s*:\s*bootstrappedStandalone/
  )

  /*
   * AppShell integration
   */

  assert.match(
    appShellSource,
    /import\s+\{\s*useStandaloneShellState\s*\}\s+from\s+['"]@\/hooks\/use-standalone-shell-state['"];?/
  )

  assert.match(
    appShellSource,
    /import\s+\{\s*shouldShowStandaloneMobileBottomNav\s*\}\s+from\s+['"]\.\/mobile-bottom-nav\.helpers['"];?/
  )

  assert.doesNotMatch(
    appShellSource,
    /setStandaloneResolved/,
    'AppShell should consume standalone state rather than manage resolution itself'
  )

  assert.match(
    appShellSource,
    /const\s+\{\s*standalone,\s*standaloneResolved\s*\}\s*=\s*useStandaloneShellState\(\);?/
  )

  /*
   * Browser / standalone chrome decisions
   */

  assert.match(
    appShellSource,
    /const\s+showBrowserHeader\s*=\s*!standaloneResolved\s*\|\|\s*!standalone;?/
  )

  assert.match(
    appShellSource,
    /const\s+showStandaloneNav\s*=\s*shouldShowStandaloneMobileBottomNav\(\{\s*hasUser:\s*Boolean\(user\),\s*standalone,\s*standaloneResolved,\s*\}\);?/
  )

  assert.match(
    appShellSource,
    /const\s+showBrowserMobileNav\s*=\s*showBrowserHeader\s*&&\s*Boolean\(user\);?/
  )

  assert.match(
    appShellSource,
    /const\s+showMobileBottomNav\s*=\s*showBrowserMobileNav\s*\|\|\s*showStandaloneNav;?/
  )

  assert.match(
    appShellSource,
    /const\s+showAuthenticatedFooter\s*=\s*Boolean\(user\)\s*&&\s*!showStandaloneNav;?/
  )

  /*
   * Header
   */

  assert.match(appShellSource, /\{showBrowserHeader\s*\?\s*\(/)

  assert.match(appShellSource, /<header\s+className="app-header hidden lg:block">/)

  assert.match(appShellSource, /<AppContainer>[\s\S]*<header|<header[\s\S]*<AppContainer>/)

  assert.match(
    appShellSource,
    /<KinoLogo\s+priority\s*\/>/,
    'desktop shell should render the canonical Kino logo'
  )

  /*
   * Main content remains centralized through AppContainer.
   */

  assert.match(
    appShellSource,
    /<main\s+className="page-main flex-1">\s*<AppContainer>\{children\}<\/AppContainer>\s*<\/main>/
  )

  /*
   * Footer
   */

  assert.match(appShellSource, /\{showAuthenticatedFooter\s*\?\s*<AppFooter\s*\/>\s*:\s*null\}/)

  /*
   * Mobile navigation
   */

  assert.match(appShellSource, /\{showMobileBottomNav\s*\?\s*\(/)

  assert.match(
    appShellSource,
    /<MobileBottomNav[\s\S]*profile=\{profileIdentity\}[\s\S]*standalone=\{standalone\}/
  )

  assert.doesNotMatch(
    appShellSource,
    /showBrowserMobileNav\s*\?\s*\([\s\S]*<nav/,
    'browser-only mobile navigation should not duplicate the standalone navigation tree'
  )

  /*
   * CSS shell behavior
   */

  assert.match(globalsCssSource, /html\[data-standalone-mode="true"\]\s+\.app-shell\s+\.app-header/)

  assert.match(globalsCssSource, /\.app-shell\.has-mobile-bottom-nav\s+\.page-main/)
})
