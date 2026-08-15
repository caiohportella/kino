export interface PersonDocumentInput {
  readonly tmdbId: number
  readonly name?: string | null
  readonly aliases?: readonly (string | null | undefined)[]
  readonly knownForDepartment?: string | null
  readonly popularity?: number | null
  readonly profilePath?: string | null
}

export interface PersonSearchDocument {
  readonly id: string
  readonly entityType: 'person'
  readonly tmdbId: number
  readonly name: string
  readonly aliases: string
  readonly knownForDepartment?: string
  readonly popularity?: number
  readonly profilePath?: string | null
}

function normalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : ''
}

function joinText(values: readonly (string | null | undefined)[]): string {
  return [...new Set(values.map(normalizeText).filter(Boolean))].join(' ')
}

export function normalizePersonDocument(input: PersonDocumentInput): PersonSearchDocument | null {
  const tmdbId = Number.isInteger(input.tmdbId) && input.tmdbId > 0 ? input.tmdbId : 0
  const name = normalizeText(input.name)
  if (!tmdbId || !name) return null
  const department = normalizeText(input.knownForDepartment)
  return {
    id: `person:${tmdbId}`,
    entityType: 'person',
    tmdbId,
    name,
    aliases: joinText(input.aliases ?? []),
    ...(department ? { knownForDepartment: department } : {}),
    ...(input.popularity == null ? {} : { popularity: input.popularity }),
    ...(input.profilePath === undefined ? {} : { profilePath: input.profilePath }),
  }
}

export function personDocumentFromTmdb(input: {
  readonly id: number
  readonly name?: string | null
  readonly known_for_department?: string | null
  readonly popularity?: number | null
  readonly profile_path?: string | null
  readonly also_known_as?: readonly string[]
}): PersonSearchDocument | null {
  return normalizePersonDocument({
    tmdbId: input.id,
    name: input.name,
    knownForDepartment: input.known_for_department,
    popularity: input.popularity,
    profilePath: input.profile_path,
    aliases: input.also_known_as,
  })
}
