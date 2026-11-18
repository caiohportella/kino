import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

const web = new URL('../../', import.meta.url)
registerHooks({
  resolve(specifier, context, next) {
    // Exercise the route outside the Next request cache. Production uses the real cache.
    if (specifier === 'next/cache') {
      return {
        url: 'data:text/javascript,export const unstable_cache = (fn) => fn',
        shortCircuit: true,
      }
    }
    if (specifier === 'server-only')
      return { url: 'data:text/javascript,export {}', shortCircuit: true }
    if (specifier === 'next/server') return next('next/server.js', context)
    if (specifier === 'next/headers')
      return next(new URL('./fixture-cookies.mjs', import.meta.url).href, context)
    if (specifier.startsWith('@/')) {
      return next(new URL(specifier.slice(2) + '.ts', web).href, context)
    }
    if (
      specifier.startsWith('./') &&
      ['/lib/agent/', '/lib/ai/', '/lib/supabase/'].some((prefix) =>
        context.parentURL?.includes(prefix)
      )
    ) {
      const file = new URL(specifier + '.ts', context.parentURL)
      if (existsSync(fileURLToPath(file))) return next(file.href, context)
    }
    return next(specifier, context)
  },
})
