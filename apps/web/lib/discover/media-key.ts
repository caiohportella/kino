export type DiscoverMediaKeyItem = {
  id: number
  media_type?: string | null
}

export function getDiscoverMediaKey(mediaType: string | null | undefined, id: number) {
  return `${mediaType ?? 'unknown'}:${id}`
}
