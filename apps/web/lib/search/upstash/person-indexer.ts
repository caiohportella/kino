import type { SearchProviderResult } from '@kino/core/search'
import {
  type RedisIndexerConfig,
  resolveRedisClient,
  toArray,
  writeJsonDocuments,
} from './indexer-utils.ts'
import { PERSON_KEY_PREFIX } from './indexes.ts'
import {
  normalizePersonDocument,
  type PersonDocumentInput,
  type PersonSearchDocument,
} from './person-document.ts'

export interface PersonIndexer {
  upsert(input: PersonDocumentInput | readonly PersonDocumentInput[]): Promise<void>
  upsertDocument(document: PersonSearchDocument | readonly PersonSearchDocument[]): Promise<void>
  deletePerson(tmdbId: number): Promise<void>
}

export function createPersonIndexer(config: RedisIndexerConfig): PersonIndexer {
  const { client, batchSize } = resolveRedisClient(config)
  return {
    async upsert(input) {
      const documents = toArray(input)
        .map(normalizePersonDocument)
        .filter((item): item is PersonSearchDocument => item !== null)
      await this.upsertDocument(documents)
    },

    async upsertDocument(document) {
      const documents = toArray(document)
      if (documents.length === 0) return
      await writeJsonDocuments(
        client,
        documents.map((value) => ({ key: `${PERSON_KEY_PREFIX}${value.tmdbId}`, value })),
        batchSize
      )
    },

    async deletePerson(tmdbId) {
      await client.del(`${PERSON_KEY_PREFIX}${tmdbId}`)
    },
  }
}

export function personDocumentsFromSearchResponse(
  result: SearchProviderResult
): readonly PersonSearchDocument[] {
  return result.candidates.flatMap((candidate) => {
    if (candidate.source !== 'person') return []
    const document = normalizePersonDocument({
      tmdbId: candidate.entity.tmdbId ?? Number(candidate.entity.id.split(':').at(-1)),
      name: candidate.entity.title,
      knownForDepartment: candidate.entity.department,
      popularity: candidate.entity.popularity,
      profilePath: candidate.entity.imageUrl,
    })
    return document ? [document] : []
  })
}
