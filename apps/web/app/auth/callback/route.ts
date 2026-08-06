import { type NextRequest, NextResponse } from 'next/server'
import { ensureServerUserProfile } from '@/lib/auth-profile-server'
import { getNativeAuthCallbackUrl, isExplicitNativeAuthHandoff } from '@/lib/auth-redirect'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function getRequestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost ?? request.headers.get('host')
  const forwardedProto = request.headers.get('x-forwarded-proto')

  if (host) {
    const protocol = forwardedProto ?? (host.startsWith('localhost') ? 'http' : 'https')

    return `${protocol}://${host}`
  }

  return request.nextUrl.origin
}

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request)
  const code = request.nextUrl.searchParams.get('code')
  const requestedNext = request.nextUrl.searchParams.get('next')

  const next =
    requestedNext?.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/discover'

  if (!code) {
    return NextResponse.redirect(new URL('/auth/login?error=callback', origin))
  }

  if (isExplicitNativeAuthHandoff(request.nextUrl.searchParams)) {
    const nativeParams = new URLSearchParams({ code })
    const returnTo = request.nextUrl.searchParams.get('returnTo')

    if (returnTo?.startsWith('/') && !returnTo.startsWith('//')) {
      nativeParams.set('returnTo', returnTo)
    }

    return NextResponse.redirect(getNativeAuthCallbackUrl(nativeParams))
  }

  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !user) {
    return NextResponse.redirect(new URL('/auth/login?error=callback', origin))
  }

  try {
    await ensureServerUserProfile(user)
  } catch {
    return NextResponse.redirect(new URL('/auth/login?error=profile', request.url))
  }

  return NextResponse.redirect(new URL(next, origin))
}
