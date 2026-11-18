import { AsyncLocalStorage } from 'node:async_hooks'

const jar = new AsyncLocalStorage()

export function withCookies(cookies, work) {
  return jar.run(cookies, work)
}

export async function cookies() {
  const current = jar.getStore()
  return {
    getAll: () => [...current].map(([name, value]) => ({ name, value })),
    set: (name, value) => current.set(name, value),
  }
}
