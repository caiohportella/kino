const AUTH_RETURN_TO_KEY = 'kino.auth.return-to'
const DEFAULT_AUTH_DESTINATION = '/(tabs)'

async function getSecureStore() {
  return import('expo-secure-store')
}

export function isSafeNativeReturnTo(value: string | null | undefined): value is string {
  if (!value || /[\\\u0000-\u001f]/.test(value)) return false

  let decoded = value
  try {
    for (let pass = 0; pass < 2; pass += 1) {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    }
  } catch {
    return false
  }

  return (
    decoded.startsWith('/') &&
    !decoded.startsWith('//') &&
    !decoded.startsWith('/auth') &&
    !decoded.startsWith('/(auth)')
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
