'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'

export function OgIdentitySync() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const userId = useAuthStore((state) => state.user?.id)

  useEffect(() => {
    if (!userId || searchParams.get('profile') === userId) return

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set('profile', userId)
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false })
  }, [pathname, router, searchParams, userId])

  return null
}
