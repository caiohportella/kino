import type { AuthResolution } from '@kino/core/auth'
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
import { dbService } from '@/services/database'
import { createAuthCallbackCompleter } from '@/utils/authCallback'
import { createAuthProfileResolver } from '@/utils/authProfile'
import { getEmailAuthRedirectUrl, getNativeAuthRedirectUrl } from '@/utils/authRedirect'
import { createMobileAuthResolver } from '@/utils/authResolution'
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
  resolution: AuthResolution<User>
  profileStatus: 'idle' | 'loading' | 'ready' | 'error'
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
const authCallbackCompleter = createAuthCallbackCompleter({
  exchangeCodeForSession: (code) => supabase.auth.exchangeCodeForSession(code),
  setSession: (tokens) => supabase.auth.setSession(tokens),
  consumeReturnTo: () => consumeAuthReturnTo(),
})

export function AuthProvider({ children }: PropsWithChildren) {
  const [resolution, setResolution] = useState<AuthResolution<User>>({
    status: 'resolving',
  })
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [processingCallback, setProcessingCallback] = useState(false)
  const [profileStatus, setProfileStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const mounted = useRef(true)
  const profileResolver = useRef(
    createAuthProfileResolver(
      (userId) => dbService.getUserProfile(userId),
      (status) => {
        if (mounted.current) setProfileStatus(status)
      }
    )
  )

  useEffect(() => {
    mounted.current = true

    const resolver = createMobileAuthResolver<User, Session>(
      supabase.auth,
      ({ resolution: nextResolution, session: nextSession }) => {
        if (!mounted.current) return
        const nextUser =
          nextResolution.status === 'authenticated'
            ? nextResolution.user
            : 'previousUser' in nextResolution
              ? (nextResolution.previousUser ?? null)
              : null
        setResolution(nextResolution)
        setSession(nextSession)
        setUser(nextUser)
        setLoading(nextResolution.status === 'resolving' && !nextUser)
        void profileResolver.current.resolve(nextUser).catch(() => undefined)
      }
    )
    const cleanupResolver = resolver.initialize()

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (!mounted.current) return
      if (state === 'active') {
        supabase.auth.startAutoRefresh()
        void resolver.refresh()
      } else {
        supabase.auth.stopAutoRefresh()
      }
    })
    supabase.auth.startAutoRefresh()

    return () => {
      mounted.current = false
      cleanupResolver()
      appStateSubscription.remove()
      supabase.auth.stopAutoRefresh()
    }
  }, [])

  const completeAuthCallback = useCallback(async (url: string) => {
    setProcessingCallback(true)
    return authCallbackCompleter.complete(url).finally(() => {
      if (mounted.current) setProcessingCallback(false)
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      resolution,
      profileStatus,
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
    [completeAuthCallback, loading, processingCallback, profileStatus, resolution, session, user]
  )

  return createElement(AuthContext.Provider, { value }, children)
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
