'use client'

import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { type AuthProfileStatus, ensureUserProfileFromAuthUser } from '@/lib/auth-profile'
import { getWebAuthCallbackUrl } from '@/lib/auth-redirect'
import { createWebAuthResolver } from '@/lib/auth-resolution'
import { supabase } from '@/lib/supabase'
import type { AuthResolution } from '../../../packages/core/src/auth/index.ts'

interface AuthState {
  resolution: AuthResolution<User>
  user: User | null
  session: Session | null
  profileStatus: AuthProfileStatus
  loading: boolean
  initialized: boolean
  initialize: () => () => void
  refreshSession: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, username?: string) => Promise<void>
  signInWithOtp: (email: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

let activeResolver: { refresh(): Promise<void> } | null = null

export const useAuthStore = create<AuthState>((set, get) => ({
  resolution: { status: 'resolving' },
  user: null,
  session: null,
  profileStatus: 'idle',
  loading: true,
  initialized: false,
  initialize: () => {
    if (get().initialized) return () => undefined
    set({ initialized: true })

    const resolver = createWebAuthResolver<User, Session>(
      supabase.auth,
      ({ resolution, session }) => {
        const previousUserId = get().user?.id
        const nextUser =
          resolution.status === 'authenticated'
            ? resolution.user
            : 'previousUser' in resolution
              ? (resolution.previousUser ?? null)
              : null
        const nextProfileStatus =
          nextUser && previousUserId === nextUser.id ? get().profileStatus : 'idle'
        set({
          resolution,
          session,
          user: nextUser,
          loading: resolution.status === 'resolving' && !nextUser,
          profileStatus: nextProfileStatus,
        })

        if (nextUser && nextProfileStatus === 'idle') {
          void ensureUserProfileFromAuthUser(nextUser, (profileStatus) => {
            if (get().user?.id === nextUser.id) set({ profileStatus })
          }).catch(() => undefined)
        }
      }
    )
    activeResolver = resolver

    const cleanup = resolver.initialize()
    return () => {
      cleanup()
      if (activeResolver === resolver) activeResolver = null
      set({ initialized: false })
    }
  },
  refreshSession: async () => {
    await activeResolver?.refresh()
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
    set({
      resolution: { status: 'unauthenticated' },
      session: null,
      user: null,
      loading: false,
      profileStatus: 'idle',
    })
  },
}))
