import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveKinoApiOrigin, SearchGatewayConfigurationError } from './searchGatewayConfig.ts'

test('production requires a deployed non-local Kino API origin', () => {
  assert.throws(
    () => resolveKinoApiOrigin(undefined, 'production'),
    (error) => error instanceof SearchGatewayConfigurationError && /required/i.test(error.message)
  )
  assert.throws(() => resolveKinoApiOrigin('http://localhost:3000', 'production'), /localhost/i)
})

test('development accepts and normalizes explicit LAN, tunnel, and preview origins', () => {
  assert.equal(
    resolveKinoApiOrigin(' http://192.168.1.20:3000/path/?ignored=yes#hash ', 'development'),
    'http://192.168.1.20:3000/path'
  )
  assert.equal(
    resolveKinoApiOrigin('https://kino-preview.example.com/', 'development'),
    'https://kino-preview.example.com'
  )
})

test('configuration never silently substitutes localhost', () => {
  assert.throws(() => resolveKinoApiOrigin(undefined, 'development'), /LAN, tunnel, or preview/i)
})
