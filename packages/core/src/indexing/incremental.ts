export type IndexMutation = 'skip' | 'upsert' | 'delete'

export interface IndexMutationDocument {
  readonly id: string
  readonly contentHash: string
  readonly indexVersion: number
}

export const decideIndexMutation = (
  previous: IndexMutationDocument | null | undefined,
  next: IndexMutationDocument | null | undefined
): IndexMutation => {
  if (!next) return previous ? 'delete' : 'skip'
  if (!previous) return 'upsert'

  return previous.id === next.id &&
    previous.contentHash === next.contentHash &&
    previous.indexVersion === next.indexVersion
    ? 'skip'
    : 'upsert'
}
