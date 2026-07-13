import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  isCanonicalResourceSegment,
  parseResourceSegment,
  personPath,
  titlePath,
} from '@/lib/routes'

export async function middleware(request: NextRequest) {
  const titleMatch = request.nextUrl.pathname.match(/^\/title\/([^/]+)$/)
  const personMatch = request.nextUrl.pathname.match(/^\/person\/([^/]+)$/)
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
  if (!apiKey || (!titleMatch && !personMatch)) return NextResponse.next()

  if (titleMatch) {
    const segment = titleMatch[1]!
    const { id } = parseResourceSegment(segment)
    if (!Number.isFinite(id)) return NextResponse.next()
    const type = request.nextUrl.searchParams.get('type') === 'tv' ? 'tv' : 'movie'
    const endpoint = type === 'tv' ? 'tv' : 'movie'
    const response = await fetch(
      `https://api.themoviedb.org/3/${endpoint}/${id}?api_key=${apiKey}&language=en`
    )
    if (!response.ok) return NextResponse.next()
    const data = (await response.json()) as { title?: string; name?: string }
    const name = data.title || data.name || `title-${id}`
    if (!isCanonicalResourceSegment(segment, id, name)) {
      return NextResponse.redirect(new URL(titlePath(id, name, type), request.url), 308)
    }
  }

  if (personMatch) {
    const segment = personMatch[1]!
    const { id } = parseResourceSegment(segment)
    if (!Number.isFinite(id)) return NextResponse.next()
    const response = await fetch(
      `https://api.themoviedb.org/3/person/${id}?api_key=${apiKey}&language=en`
    )
    if (!response.ok) return NextResponse.next()
    const data = (await response.json()) as { name?: string }
    const name = data.name || `person-${id}`
    if (!isCanonicalResourceSegment(segment, id, name)) {
      return NextResponse.redirect(new URL(personPath(id, name), request.url), 308)
    }
  }

  return NextResponse.next()
}

export const config = { matcher: ['/title/:path*', '/person/:path*'] }
