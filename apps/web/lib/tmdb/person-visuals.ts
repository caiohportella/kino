import type { TMDbPerson } from '@kino/core'
import { getKnownForCredits } from '@kino/core'

export function getPersonImagePaths(person: TMDbPerson) {
  const bannerCredit = getKnownForCredits(person.combined_credits, 24).find(
    (credit) => credit.backdrop_path
  )
  const knownForTitle = person.known_for?.find((title) => title.backdrop_path)

  return {
    bannerPath: bannerCredit?.backdrop_path ?? knownForTitle?.backdrop_path ?? null,
    portraitPath: person.profile_path,
  }
}
