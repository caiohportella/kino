'use client'

import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { ensureUserProfileFromAuthUser } from '@/lib/auth-profile'
import { getWebAuthCallbackUrl } from '@/lib/auth-redirect'
import { supabase } from '@/lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  initialized: boolean
  initialize: () => () => void
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, username?: string) => Promise<void>
  signInWithOtp: (email: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,
  initialize: () => {
    if (get().initialized) return () => undefined
    set({ initialized: true, loading: true })

    supabase.auth.getSession().then(({ data }) => {
      const nextUser = data.session?.user ?? null
      set({ session: data.session, user: nextUser, loading: false })
      void ensureUserProfileFromAuthUser(nextUser).catch(() => undefined)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null
      set({ session, user: nextUser, loading: false })
      void ensureUserProfileFromAuthUser(nextUser).catch(() => undefined)
    })

    return () => subscription.unsubscribe()
  },
  signInWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  },
  signUpWithEmail: async (email, password, username) => {
    const redirectTo = getWebAuthCallbackUrl()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: username ? { display_name: username, username } : undefined,
      },
    })
    if (error) throw error
  },
  signInWithOtp: async (email) => {
    const redirectTo = getWebAuthCallbackUrl()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    })
    if (error) throw error
  },
  signInWithGoogle: async () => {
    const redirectTo = getWebAuthCallbackUrl()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) throw error
  },
  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    set({ session: null, user: null, loading: false })
  },
}))
