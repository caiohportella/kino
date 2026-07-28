import { createIndexContentHash } from './content-hash.ts'
import type {
  NormalizedIndexPersonReference,
  NormalizedIndexTitleReference,
  NormalizedSearchIndexInput,
  SearchIndexDocumentPayloadV1,
  SearchIndexDocumentV1,
  SearchIndexMediaMetadataV1,
  SearchIndexPersonMetadataV1,
  SearchIndexRelationshipRole,
} from './types.ts'
import { versionSearchIndexDocumentPayloadV1 } from './version.ts'

export type BuildSearchIndexDocumentV1Input = NormalizedSearchIndexInput

const RELATIONSHIP_ROLES = new Set<SearchIndexRelationshipRole>([
  'acting',
  'directing',
  'creating',
  'writing',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const cleanText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const normalized = value.replace(/\s+/gu, ' ').trim()
  return normalized || undefined
}

const requiredText = (value: unknown, field: string): string => {
  const normalized = cleanText(value)
  if (!normalized) throw new TypeError(`${field} must be a non-empty string`)
  return normalized
}

const compareText = (left: string, right: string): number => {
  if (left === right) return 0
  return left < right ? -1 : 1
}

const uniqueSortedText = (values: readonly unknown[] | undefined): string[] =>
  [
    ...new Set((values ?? []).map(cleanText).filter((value): value is string => Boolean(value))),
  ].sort(compareText)

const isRelationshipRole = (value: unknown): value is SearchIndexRelationshipRole =>
  typeof value === 'string' && RELATIONSHIP_ROLES.has(value as SearchIndexRelationshipRole)

const readCastOrder = (value: unknown): number | undefined | null => {
  if (value === undefined) return undefined
  if (!Number.isInteger(value) || (value as number) < 0) return null
  return value as number
}

const compareRelationships = (
  left: NormalizedIndexPersonReference | NormalizedIndexTitleReference,
  right: NormalizedIndexPersonReference | NormalizedIndexTitleReference
): number => {
  const leftOrder = left.role === 'acting' ? left.castOrder : undefined
  const rightOrder = right.role === 'acting' ? right.castOrder : undefined
  if (leftOrder !== undefined || rightOrder !== undefined) {
    if (leftOrder === undefined) return 1
    if (rightOrder === undefined) return -1
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
  }

  const roleOrder = compareText(left.role, right.role)
  if (roleOrder !== 0) return roleOrder
  const leftLabel = 'name' in left ? left.name : left.title
  const rightLabel = 'name' in right ? right.name : right.title
  const labelOrder = compareText(leftLabel, rightLabel)
  return labelOrder || compareText(left.id, right.id)
}

const normalizePeople = (
  values: readonly unknown[] | undefined
): NormalizedIndexPersonReference[] => {
  const normalized: NormalizedIndexPersonReference[] = []

  for (const value of values ?? []) {
    if (!isRecord(value)) continue
    const id = cleanText(value.id)
    const name = cleanText(value.name)
    const castOrder = readCastOrder(value.castOrder)
    if (!id || !name || !isRelationshipRole(value.role) || castOrder === null) continue
    const character = cleanText(value.character)
    normalized.push({
      id,
      name,
      role: value.role,
      ...(character ? { character } : {}),
      ...(castOrder === undefined ? {} : { castOrder }),
    })
  }

  return deduplicateRelationships(normalized.sort(compareRelationships))
}

const normalizeTitleRelationships = (
  values: readonly unknown[] | undefined
): NormalizedIndexTitleReference[] => {
  const normalized: NormalizedIndexTitleReference[] = []

  for (const value of values ?? []) {
    if (!isRecord(value)) continue
    const id = cleanText(value.id)
    const title = cleanText(value.title)
    const castOrder = readCastOrder(value.castOrder)
    if (
      !id ||
      !title ||
      (value.entityType !== 'movie' && value.entityType !== 'series') ||
      !isRelationshipRole(value.role) ||
      castOrder === null
    ) {
      continue
    }
    const character = cleanText(value.character)
    normalized.push({
      id,
      entityType: value.entityType,
      title,
      role: value.role,
      ...(character ? { character } : {}),
      ...(castOrder === undefined ? {} : { castOrder }),
    })
  }

  return deduplicateRelationships(normalized.sort(compareRelationships))
}

const deduplicateRelationships = <
  T extends NormalizedIndexPersonReference | NormalizedIndexTitleReference,
>(
  relationships: readonly T[]
): T[] => {
  const seen = new Set<string>()
  return relationships.filter((relationship) => {
    const label = 'name' in relationship ? relationship.name : relationship.title
    const key = [
      relationship.id,
      relationship.role,
      label,
      relationship.character ?? '',
      relationship.castOrder ?? '',
    ].join('\u0000')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const relationshipText = (
  relationship: NormalizedIndexPersonReference | NormalizedIndexTitleReference
): string => {
  const label = 'name' in relationship ? relationship.name : relationship.title
  return `${relationship.role}: ${label}${
    relationship.character ? ` as ${relationship.character}` : ''
  }`
}

const buildMediaDocument = (
  input: Extract<BuildSearchIndexDocumentV1Input, { entityType: 'movie' | 'series' }>
): SearchIndexDocumentPayloadV1 => {
  const title = requiredText(input.title, 'title')
  const originalTitle = cleanText(input.originalTitle)
  const alternativeTitles = uniqueSortedText(input.alternativeTitles).filter(
    (alternative) => alternative !== title && alternative !== originalTitle
  )
  const overview = cleanText(input.overview)
  const releaseDate = cleanText(input.releaseDate)
  const locale = cleanText(input.locale)
  const genres = uniqueSortedText(input.genres)
  const keywords = uniqueSortedText(input.keywords)
  const franchise = cleanText(input.franchise)
  const people = normalizePeople(input.people)
  const metadata: SearchIndexMediaMetadataV1 = {
    tmdbId: input.tmdbId,
    title,
    ...(originalTitle ? { originalTitle } : {}),
    alternativeTitles,
    ...(overview ? { overview } : {}),
    ...(releaseDate ? { releaseDate } : {}),
    ...(locale ? { locale } : {}),
    genres,
    keywords,
    ...(franchise ? { franchise } : {}),
    people,
  }
  const searchableText = [
    `title: ${title}`,
    ...(originalTitle && originalTitle !== title ? [`original title: ${originalTitle}`] : []),
    ...alternativeTitles.map((alternative) => `alternative title: ${alternative}`),
    ...(overview ? [`overview: ${overview}`] : []),
    ...people.map(relationshipText),
    ...genres.map((genre) => `genre: ${genre}`),
    ...keywords.map((keyword) => `keyword: ${keyword}`),
    ...(franchise ? [`franchise: ${franchise}`] : []),
    ...(locale ? [`locale: ${locale}`] : []),
  ].join('\n')

  return versionSearchIndexDocumentPayloadV1({
    id: requiredText(input.id, 'id'),
    entityType: input.entityType,
    searchableText,
    metadata,
  })
}

const buildPersonDocument = (
  input: Extract<BuildSearchIndexDocumentV1Input, { entityType: 'person' }>
): SearchIndexDocumentPayloadV1 => {
  const name = requiredText(input.name, 'name')
  const alternativeNames = uniqueSortedText(input.alternativeNames).filter(
    (alternative) => alternative !== name
  )
  const biography = cleanText(input.biography)
  const locale = cleanText(input.locale)
  const knownForDepartment = cleanText(input.knownForDepartment)
  const relationships = normalizeTitleRelationships(input.relationships)
  const metadata: SearchIndexPersonMetadataV1 = {
    tmdbId: input.tmdbId,
    name,
    alternativeNames,
    ...(biography ? { biography } : {}),
    ...(locale ? { locale } : {}),
    ...(knownForDepartment ? { knownForDepartment } : {}),
    relationships,
  }
  const searchableText = [
    `name: ${name}`,
    ...alternativeNames.map((alternative) => `alternative name: ${alternative}`),
    ...(biography ? [`biography: ${biography}`] : []),
    ...relationships.map(relationshipText),
    ...(knownForDepartment ? [`known for: ${knownForDepartment}`] : []),
    ...(locale ? [`locale: ${locale}`] : []),
  ].join('\n')

  return versionSearchIndexDocumentPayloadV1({
    id: requiredText(input.id, 'id'),
    entityType: 'person',
    searchableText,
    metadata,
  })
}

export const buildSearchIndexDocumentV1 = async (
  input: BuildSearchIndexDocumentV1Input
): Promise<SearchIndexDocumentV1> => {
  const payload =
    input.entityType === 'person' ? buildPersonDocument(input) : buildMediaDocument(input)
  const contentHash = await createIndexContentHash(payload)
  return { ...payload, contentHash } as SearchIndexDocumentV1
}
