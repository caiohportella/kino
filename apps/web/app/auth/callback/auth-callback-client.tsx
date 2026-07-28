'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EmptyState } from '@/components/kino'
import { AuthSkeleton } from '@/components/skeletons/page-skeletons'
import { ensureUserProfileFromAuthUser } from '@/lib/auth-profile'
import {
  consumeStoredAuthRedirect,
  getNativeAuthCallbackUrl,
  isExplicitNativeAuthHandoff,
} from '@/lib/auth-redirect'
import { supabase } from '@/lib/supabase'

function getHashParams() {
  if (typeof window === 'undefined') return new URLSearchParams()
  return new URLSearchParams(window.location.hash.replace(/^#/, ''))
}

export function AuthCallbackClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [nativeCallbackUrl, setNativeCallbackUrl] = useState<string | null>(null)
  const hasHandledCallback = useRef(false)

  const completeBrowserSignIn = useCallback(
    async (code: string | null, accessToken: string | null, refreshToken: string | null) => {
      const { data, error: signInError } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : accessToken && refreshToken
          ? await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
          : { data: { session: null }, error: new Error('Invalid authentication callback.') }

      if (signInError) {
        setError('Sign-in could not be completed. Please start again.')
        return
      }

      await ensureUserProfileFromAuthUser(data.session?.user).catch(() => undefined)
      router.replace(consumeStoredAuthRedirect('/discover'))
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
      setError('The authentication request was canceled or expired. Please try again.')
      return
    }

    const code = searchParams.get('code') || hashParams.get('code')
    const accessToken = searchParams.get('access_token') || hashParams.get('access_token')
    const refreshToken = searchParams.get('refresh_token') || hashParams.get('refresh_token')

    if (isExplicitNativeAuthHandoff(searchParams)) {
      if (!code) {
        setError(
          'This mobile callback cannot be handed off safely. Please restart sign-in in Kino.'
        )
        return
      }
      const nativeParams = new URLSearchParams({ code })
      const returnTo = searchParams.get('returnTo')
      if (returnTo?.startsWith('/') && !returnTo.startsWith('//')) {
        nativeParams.set('returnTo', returnTo)
      }
      const callbackUrl = getNativeAuthCallbackUrl(nativeParams)
      setNativeCallbackUrl(callbackUrl)
      window.location.replace(callbackUrl)
      return
    }

    void completeBrowserSignIn(code, accessToken, refreshToken)
  }, [completeBrowserSignIn, searchParams])

  if (error) {
    return <EmptyState body={error} title="Sign-in could not be completed" />
  }

  if (nativeCallbackUrl) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <section className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold">Authentication completed</h1>
          <p className="mt-3 text-zinc-400">Kino should open automatically.</p>
          <a
            className="mt-6 inline-flex rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-black"
            href={nativeCallbackUrl}
          >
            Open Kino
          </a>
        </section>
      </main>
    )
  }

  return <AuthSkeleton label="Completing sign-in..." />
}
