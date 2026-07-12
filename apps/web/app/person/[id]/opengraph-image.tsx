import { getDisplayTitle, getReleaseYear } from '@kino/core'
import { ImageResponse } from 'next/og'
import { FallbackOg, getOgImageOptions, OG_SIZE, PersonOg } from '@/lib/og'
import { safeImageData } from '@/lib/og-images'
import { parseResourceSegment } from '@/lib/routes'
import { getPersonSeoData } from '@/lib/server-tmdb'

export const runtime = 'edge'
export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'Kino person preview'

const departmentLabels: Record<string, string> = {
  Acting: 'Actor',
  Directing: 'Director',
  Writing: 'Writer',
  Production: 'Producer',
}

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const personId = parseResourceSegment(id).id

  if (!Number.isFinite(personId) || personId <= 0) {
    return new ImageResponse(<FallbackOg label="Person" title="Person not found" />, await getOgImageOptions())
  }

  try {
    const person = await getPersonSeoData(personId, 'en')
    const portraitUrl = person.profile_path ? `https://image.tmdb.org/t/p/w780${person.profile_path}` : null
    const portrait = await safeImageData(portraitUrl)
    const credits = [...(person.combined_credits?.cast ?? []), ...(person.combined_credits?.crew ?? [])]
    const knownFor = credits
      .filter((credit) => credit.media_type === 'movie' || credit.media_type === 'tv')
      .sort(
        (left, right) =>
          (right.vote_average || 0) - (left.vote_average || 0) ||
          ((getReleaseYear(right) ?? 0) - (getReleaseYear(left) ?? 0))
      )
      .map((credit) => getDisplayTitle(credit))
      .filter((title, index, titles) => Boolean(title) && titles.indexOf(title) === index)
      .slice(0, 3)

    const role = person.known_for_department
      ? departmentLabels[person.known_for_department] || person.known_for_department
      : null

    return new ImageResponse(
      <PersonOg knownFor={knownFor} name={person.name} portrait={portrait} role={role} />,
      await getOgImageOptions()
    )
  } catch {
    return new ImageResponse(<FallbackOg label="Person" title="Person not found" />, await getOgImageOptions())
  }
}
