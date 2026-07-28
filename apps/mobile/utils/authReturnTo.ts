import * as SecureStore from 'expo-secure-store'

const AUTH_RETURN_TO_KEY = 'kino.auth.return-to'
const DEFAULT_AUTH_DESTINATION = '/(tabs)'

export function isSafeNativeReturnTo(value: string | null | undefined): value is string {
  return Boolean(
    value &&
      value.startsWith('/') &&
      !value.startsWith('//') &&
      !value.startsWith('/auth') &&
      !value.startsWith('/(auth)')
  )
}

export async function storeAuthReturnTo(value?: string) {
  if (!isSafeNativeReturnTo(value)) {
    await SecureStore.deleteItemAsync(AUTH_RETURN_TO_KEY)
    return
  }
  await SecureStore.setItemAsync(AUTH_RETURN_TO_KEY, value)
}

export async function consumeAuthReturnTo() {
  const value = await SecureStore.getItemAsync(AUTH_RETURN_TO_KEY)
  await SecureStore.deleteItemAsync(AUTH_RETURN_TO_KEY)
  return isSafeNativeReturnTo(value) ? value : DEFAULT_AUTH_DESTINATION
}

export async function clearAuthReturnTo() {
  await SecureStore.deleteItemAsync(AUTH_RETURN_TO_KEY)
}
