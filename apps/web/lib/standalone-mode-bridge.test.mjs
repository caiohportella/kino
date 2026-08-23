import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getStandaloneModeBootstrapScript,
  readStandaloneModeAttribute,
} from './standalone-mode-bridge.ts'

test('reads standalone mode from the bootstrapped root attribute', () => {
  const standaloneDocument = {
    documentElement: {
      getAttribute(name) {
        return name === 'data-standalone-mode' ? 'true' : null
      },
    },
  }

  const browserDocument = {
    documentElement: {
      getAttribute() {
        return 'false'
      },
    },
  }

  assert.equal(readStandaloneModeAttribute(standaloneDocument), true)
  assert.equal(readStandaloneModeAttribute(browserDocument), false)
  assert.equal(readStandaloneModeAttribute(undefined), false)
})

test('bootstrap script sets the root standalone attribute before paint', () => {
  const script = getStandaloneModeBootstrapScript()

  assert.match(script, /window\.matchMedia/)
  assert.match(script, /navigator\.standalone/)
  assert.match(script, /document\.documentElement\.setAttribute/)
})
