'use client'

import { EmptyState } from '@/components/kino'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthSkeleton } from '@/components/skeletons/page-skeletons'
import {
  consumeStoredAuthRedirect,
  getNativeAuthCallbackUrl,
  shouldAttemptNativeAuthHandoff,
} from '@/lib/auth-redirect'
import { ensureUserProfileFromAuthUser } from '@/lib/auth-profile'
import { supabase } from '@/lib/supabase'

type AuthCallbackPayload =
  | {
      type: 'code'
      code: string
      nativeSearchParams: URLSearchParams
      nativeHashParams?: URLSearchParams
    }
  | {
      type: 'tokens'
      accessToken: string
      refreshToken: string
      nativeSearchParams: URLSearchParams
      nativeHashParams?: URLSearchParams
    }

function getHashParams() {
  if (typeof window === 'undefined') return new URLSearchParams()
  return new URLSearchParams(window.location.hash.replace(/^#/, ''))
}

export function AuthCallbackClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const hasHandledCallback = useRef(false)

  const completeBrowserSignIn = useCallback(
    async (payload: AuthCallbackPayload) => {
      const { data, error: signInError } =
        payload.type === 'code'
          ? await supabase.auth.exchangeCodeForSession(payload.code)
          : await supabase.auth.setSession({
              access_token: payload.accessToken,
              refresh_token: payload.refreshToken,
            })

      if (signInError) {
        setError(signInError.message)
      } else {
        await ensureUserProfileFromAuthUser(data.session?.user).catch(() => undefined)
        router.replace(consumeStoredAuthRedirect('/discover'))
      }
    },
    [router]
  )

  useEffect(() => {
    if (hasHandledCallback.current) return
    hasHandledCallback.current = true

    const hashParams = getHashParams()
    const errorDescription =
      searchParams.get('error_description') || hashParams.get('error_description')

    if (errorDescription) {
      setError(errorDescription)
      return
    }

    const code = searchParams.get('code') || hashParams.get('code')
    const accessToken = searchParams.get('access_token') || hashParams.get('access_token')
    const refreshToken = searchParams.get('refresh_token') || hashParams.get('refresh_token')
    const payload: AuthCallbackPayload | null = code
      ? {
          type: 'code',
          code,
          nativeSearchParams: new URLSearchParams({ code }),
        }
      : accessToken && refreshToken
        ? {
            type: 'tokens',
            accessToken,
            refreshToken,
            nativeSearchParams: new URLSearchParams(),
            nativeHashParams: new URLSearchParams({
              access_token: accessToken,
              refresh_token: refreshToken,
            }),
          }
        : null

    if (!payload) {
      setError('The auth callback did not include a code or session tokens.')
      return
    }

    const shouldHandoffToNative =
      searchParams.get('handoff') !== '0' && shouldAttemptNativeAuthHandoff()

    if (!shouldHandoffToNative) {
      void completeBrowserSignIn(payload)
      return
    }

    const fallbackTimer = window.setTimeout(() => {
      void completeBrowserSignIn(payload)
    }, 1600)

    const cancelFallbackIfAppOpened = () => {
      if (document.visibilityState === 'hidden') {
        window.clearTimeout(fallbackTimer)
      }
    }

    document.addEventListener('visibilitychange', cancelFallbackIfAppOpened)
    window.location.assign(
      getNativeAuthCallbackUrl(payload.nativeSearchParams, payload.nativeHashParams)
    )

    return () => {
      window.clearTimeout(fallbackTimer)
      document.removeEventListener('visibilitychange', cancelFallbackIfAppOpened)
    }
  }, [completeBrowserSignIn, searchParams])

  if (error) {
    return <EmptyState body={error} title="Sign-in could not be completed" />
  }

  return <AuthSkeleton label="Completing sign-in..." />
}
