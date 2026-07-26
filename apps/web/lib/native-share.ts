export type NativeShareResource = {
  title: string
  shareText?: string
  canonicalUrl: string
}

type NativeShareCapabilities = {
  origin: string
  share?: (data: ShareData) => Promise<void>
  copy: (value: string) => Promise<void>
}

export type NativeShareResult = 'shared' | 'copied' | 'cancelled'

export function normalizeShareUrl(url: string, origin: string) {
  return new URL(url, origin).toString()
}

export function isShareCancellation(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.name === 'NotAllowedError')
  )
}

export async function shareResource(
  resource: NativeShareResource,
  capabilities: NativeShareCapabilities
): Promise<NativeShareResult> {
  const canonicalUrl = normalizeShareUrl(resource.canonicalUrl, capabilities.origin)

  if (capabilities.share) {
    try {
      await capabilities.share({
        title: resource.title,
        text: resource.shareText,
        url: canonicalUrl,
      })
      return 'shared'
    } catch (error) {
      if (isShareCancellation(error)) return 'cancelled'
      throw error
    }
  }

  await capabilities.copy(canonicalUrl)
  return 'copied'
}
