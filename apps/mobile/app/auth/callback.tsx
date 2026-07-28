import * as Linking from 'expo-linking'
import { type Href, router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '@/hooks/useAuth'

export default function AuthCallbackScreen() {
  const callbackUrl = Linking.useURL()
  const { completeAuthCallback } = useAuth()
  const handledUrl = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!callbackUrl || handledUrl.current === callbackUrl) return
    handledUrl.current = callbackUrl

    void completeAuthCallback(callbackUrl)
      .then((destination) => router.replace(destination as Href))
      .catch((callbackError: unknown) => {
        setError(
          callbackError instanceof Error
            ? callbackError.message
            : 'Authentication could not be completed. Please try again.'
        )
      })
  }, [callbackUrl, completeAuthCallback])

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text style={styles.title}>Sign-in could not be completed</Text>
          <Text style={styles.message}>{error}</Text>
          <Pressable style={styles.button} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.buttonText}>Back to sign in</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color="#1DB954" size="large" />
          <Text style={styles.title}>Completing sign-in…</Text>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: '#121212',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: '#c7c7c7',
    fontSize: 15,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#1DB954',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#080808',
    fontWeight: '700',
  },
})
