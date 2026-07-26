import { Share } from 'react-native'

export type NativeShareResource = {
  title: string
  canonicalUrl: string
  shareText?: string
}

export async function shareNativeResource(resource: NativeShareResource) {
  return Share.share({
    message: [resource.shareText, resource.canonicalUrl].filter(Boolean).join(' '),
    title: resource.title,
    url: resource.canonicalUrl,
  })
}
