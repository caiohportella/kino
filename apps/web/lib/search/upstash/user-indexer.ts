import type { UserProfile } from '@kino/core'

import {
  type RedisIndexerConfig,
  resolveRedisClient,
  toArray,
  writeJsonDocuments,
} from './indexer-utils.ts'
import { USER_KEY_PREFIX } from './indexes.ts'
import {
  normalizeUserDocument,
  normalizeUserDocumentFromProfile,
  type UserDocumentInput,
  type UserSearchDocument,
} from './user-document.ts'

export interface UserIndexer {
  upsert(input: UserDocumentInput | readonly UserDocumentInput[]): Promise<void>
  upsertDocument(document: UserSearchDocument | readonly UserSearchDocument[]): Promise<void>
  deleteUser(userId: string): Promise<void>
}

export function createUserIndexer(config: RedisIndexerConfig): UserIndexer {
  const { client, batchSize } = resolveRedisClient(config)
  return {
    async upsert(input) {
      const documents = toArray(input)
        .map(normalizeUserDocument)
        .filter((item): item is UserSearchDocument => item !== null)
      await this.upsertDocument(documents)
    },

    async upsertDocument(document) {
      const documents = toArray(document)
      if (documents.length === 0) return
      await writeJsonDocuments(
        client,
        documents.map((value) => ({ key: `${USER_KEY_PREFIX}${value.userId}`, value })),
        batchSize
      )
    },

    async deleteUser(userId) {
      await client.del(`${USER_KEY_PREFIX}${userId}`)
    },
  }
}

export function userDocumentFromProfile(profile: UserProfile): UserSearchDocument | null {
  return normalizeUserDocumentFromProfile(profile)
}
