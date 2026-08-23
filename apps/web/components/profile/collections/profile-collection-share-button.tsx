'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { ShareButton } from '@/components/share-button'

export function ProfileCollectionShareButton({
  label,
  text,
  title,
}: {
  label?: string
  text?: string
  title: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const query = searchParams.toString()
  const url = query ? `${pathname}?${query}` : pathname

  return <ShareButton label={label} text={text} title={title} url={url} />
}
