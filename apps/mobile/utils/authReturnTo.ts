const AUTH_RETURN_TO_KEY = 'kino.auth.return-to'
const DEFAULT_AUTH_DESTINATION = '/(tabs)'

async function getSecureStore() {
  return import('expo-secure-store')
}

export function isSafeNativeReturnTo(value: string | null | undefined): value is string {
  if (!value || /[\\\u0000-\u001f]/.test(value)) return false

  try {
    if (decodeURIComponent(value) !== value) return false
  } catch {
    return false
  }

  const path = value.split(/[?#]/, 1)[0]
  const segments = path.split('/')
  return (
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !segments.some((segment) => segment === '.' || segment === '..') &&
    !/^\/(?:auth|\(auth\))(?:\/|$)/i.test(path)
  )
}

export async function storeAuthReturnTo(value?: string) {
  const SecureStore = await getSecureStore()
  if (!isSafeNativeReturnTo(value)) {
    await SecureStore.deleteItemAsync(AUTH_RETURN_TO_KEY)
    return
  }
  await SecureStore.setItemAsync(AUTH_RETURN_TO_KEY, value)
}

export async function consumeAuthReturnTo() {
  const SecureStore = await getSecureStore()
  const value = await SecureStore.getItemAsync(AUTH_RETURN_TO_KEY)
  await SecureStore.deleteItemAsync(AUTH_RETURN_TO_KEY)
  return isSafeNativeReturnTo(value) ? value : DEFAULT_AUTH_DESTINATION
}

export async function clearAuthReturnTo() {
  const SecureStore = await getSecureStore()
  await SecureStore.deleteItemAsync(AUTH_RETURN_TO_KEY)
}
