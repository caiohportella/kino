// Authentication hook
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import type { User, Session } from '@supabase/supabase-js'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import * as QueryParams from 'expo-auth-session/build/QueryParams'
import { Alert } from 'react-native'
import { getEmailAuthRedirectUrl, getNativeAuthRedirectUrl } from '@/utils/authRedirect'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const emailRedirectTo = getEmailAuthRedirectUrl()
  const nativeRedirectTo = getNativeAuthRedirectUrl()

  const createSessionFromUrl = async (url: string) => {
    try {
      const { params, errorCode } = QueryParams.getQueryParams(url)

      if (errorCode) {
        Alert.alert('Auth Error', `Error code: ${errorCode}`)
        throw new Error(errorCode)
      }

      const { access_token, refresh_token, code } = params

      if (access_token && refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        })

        if (error) throw error
        return data.session
      }

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) throw error
        return data.session
      }
    } catch (error) {
      Alert.alert('Auth Exception', String(error))
    }
  }

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // 3. Handle incoming deep links (Magic Link click when app is backgrounded/open)
    const subscriptionLinking = Linking.addEventListener('url', (event) => {
      createSessionFromUrl(event.url)
    })

    // 4. Handle initial deep link (Magic Link click when app is closed)
    Linking.getInitialURL().then((url) => {
      if (url) createSessionFromUrl(url)
    })

    return () => {
      subscription.unsubscribe()
      subscriptionLinking.remove()
    }
  }, [])

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
      },
    })
    if (error) throw error
  }

  const signInWithOtp = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo,
      },
    })
    if (error) throw error
  }

  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: nativeRedirectTo,
          skipBrowserRedirect: true,
        },
      })

      if (error) throw error

      // Open the auth session for OAuth
      const res = await WebBrowser.openAuthSessionAsync(data?.url ?? '', nativeRedirectTo)

      if (res.type === 'success') {
        const { url } = res
        if (url) {
          await createSessionFromUrl(url)
        }
      }
    } catch (error) {
      console.error('Google Sign-In Error:', error)
      throw error
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    signInWithEmail,
    signUpWithEmail,
    signInWithOtp,
    signInWithGoogle,
    signOut,
  }
}
