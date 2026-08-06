import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  isCanonicalResourceSegment,
  parseResourceSegment,
  personPath,
  titlePath,
} from '@/lib/routes'
import { updateSession } from '@/lib/supabase/middleware'

function redirectWithSession(
  request: NextRequest,
  sessionResponse: NextResponse,
  pathname: string
) {
  const response = NextResponse.redirect(new URL(pathname, request.url), 308)

  sessionResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie)
  })

  return response
}

export async function middleware(request: NextRequest) {
  const sessionResponse = await updateSession(request)
  const titleMatch = request.nextUrl.pathname.match(/^\/title\/([^/]+)$/)
  const personMatch = request.nextUrl.pathname.match(/^\/person\/([^/]+)$/)
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
  if (!apiKey || (!titleMatch && !personMatch)) return sessionResponse

  if (titleMatch) {
    const segment = titleMatch[1]!
    const { id } = parseResourceSegment(segment)
    if (!Number.isFinite(id)) return sessionResponse
    const type = request.nextUrl.searchParams.get('type') === 'tv' ? 'tv' : 'movie'
    const endpoint = type === 'tv' ? 'tv' : 'movie'
    const response = await fetch(
      `https://api.themoviedb.org/3/${endpoint}/${id}?api_key=${apiKey}&language=en`
    )
    if (!response.ok) return sessionResponse
    const data = (await response.json()) as { title?: string; name?: string }
    const name = data.title || data.name || `title-${id}`
    if (!isCanonicalResourceSegment(segment, id, name)) {
      return redirectWithSession(request, sessionResponse, titlePath(id, name, type))
    }
  }

  if (personMatch) {
    const segment = personMatch[1]!
    const { id } = parseResourceSegment(segment)
    if (!Number.isFinite(id)) return sessionResponse
    const response = await fetch(
      `https://api.themoviedb.org/3/person/${id}?api_key=${apiKey}&language=en`
    )
    if (!response.ok) return sessionResponse
    const data = (await response.json()) as { name?: string }
    const name = data.name || `person-${id}`
    if (!isCanonicalResourceSegment(segment, id, name)) {
      return redirectWithSession(request, sessionResponse, personPath(id, name))
    }
  }

  return sessionResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
