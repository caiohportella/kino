import type { Session, User } from '@supabase/supabase-js'
import * as WebBrowser from 'expo-web-browser'
import {
  createContext,
  createElement,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AppState } from 'react-native'
import { getAuthCallbackPayload, sanitizeAuthError } from '@/utils/authCallback'
import { getEmailAuthRedirectUrl, getNativeAuthRedirectUrl } from '@/utils/authRedirect'
import { clearAuthReturnTo, consumeAuthReturnTo, storeAuthReturnTo } from '@/utils/authReturnTo'
import { supabase } from '@/utils/supabase'

WebBrowser.maybeCompleteAuthSession()

export class AuthFlowCancelledError extends Error {
  constructor() {
    super('Google authentication was canceled.')
    this.name = 'AuthFlowCancelledError'
  }
}

type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  processingCallback: boolean
  isAuthenticated: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signInWithOtp: (email: string) => Promise<void>
  signInWithGoogle: (returnTo?: string) => Promise<string | null>
  completeAuthCallback: (url: string) => Promise<string>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
let activeCallback: Promise<string> | null = null
const consumedCodes = new Set<string>()

async function exchangeCallback(url: string) {
  const payload = getAuthCallbackPayload(url)

  if (payload.error) {
    throw new Error(sanitizeAuthError(payload.error))
  }

  if (payload.code) {
    if (consumedCodes.has(payload.code)) {
      return consumeAuthReturnTo()
    }
    consumedCodes.add(payload.code)
    const { error } = await supabase.auth.exchangeCodeForSession(payload.code)
    if (error) {
      consumedCodes.delete(payload.code)
      throw new Error('The authentication request expired or could not be completed.')
    }
    return consumeAuthReturnTo()
  }

  if (payload.accessToken && payload.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: payload.accessToken,
      refresh_token: payload.refreshToken,
    })
    if (error) throw new Error('The authentication session could not be saved.')
    return consumeAuthReturnTo()
  }

  throw new Error('The authentication callback is invalid or is missing its authorization code.')
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [processingCallback, setProcessingCallback] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted.current) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted.current) return
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    })

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh()
      } else {
        supabase.auth.stopAutoRefresh()
      }
    })
    supabase.auth.startAutoRefresh()

    return () => {
      mounted.current = false
      subscription.unsubscribe()
      appStateSubscription.remove()
      supabase.auth.stopAutoRefresh()
    }
  }, [])

  const completeAuthCallback = useCallback(async (url: string) => {
    if (activeCallback) return activeCallback

    setProcessingCallback(true)
    activeCallback = exchangeCallback(url).finally(() => {
      activeCallback = null
      if (mounted.current) setProcessingCallback(false)
    })
    return activeCallback
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      processingCallback,
      isAuthenticated: Boolean(user),
      signInWithEmail: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      signUpWithEmail: async (email, password) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: getEmailAuthRedirectUrl() },
        })
        if (error) throw error
      },
      signInWithOtp: async (email) => {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: getNativeAuthRedirectUrl(),
          },
        })
        if (error) throw error
      },
      signInWithGoogle: async (returnTo) => {
        const redirectTo = getNativeAuthRedirectUrl()
        await storeAuthReturnTo(returnTo)

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo,
            skipBrowserRedirect: true,
          },
        })
        if (error || !data.url) {
          await clearAuthReturnTo()
          throw error ?? new Error('Google authentication could not be started.')
        }

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
        if (result.type === 'cancel' || result.type === 'dismiss') {
          await clearAuthReturnTo()
          throw new AuthFlowCancelledError()
        }
        if (result.type !== 'success' || !result.url) {
          await clearAuthReturnTo()
          throw new Error('Google authentication did not return a valid callback.')
        }

        return completeAuthCallback(result.url)
      },
      completeAuthCallback,
      signOut: async () => {
        await clearAuthReturnTo()
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      },
    }),
    [completeAuthCallback, loading, processingCallback, session, user]
  )

  return createElement(AuthContext.Provider, { value }, children)
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
