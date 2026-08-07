'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useState } from 'react'
import { ServiceWorkerRegister } from '@/components/service-worker-register'
import { HomeSkeleton } from '@/components/skeletons/page-skeletons'
import { ToastProvider } from '@/components/toast-provider'
import { createQueryClient } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient())
  const initialize = useAuthStore((state) => state.initialize)
  const hydrateLanguage = useSettingsStore((state) => state.hydrateLanguage)
  const language = useSettingsStore((state) => state.language)
  const localeStatus = useSettingsStore((state) => state.localeStatus)
  const router = useRouter()

  useEffect(() => initialize(), [initialize])
  useEffect(() => {
    let active = true
    void hydrateLanguage().then(() => {
      if (active) router.refresh()
    })
    return () => {
      active = false
    }
  }, [hydrateLanguage, router])
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ServiceWorkerRegister />
        {localeStatus === 'resolving' ? <HomeSkeleton /> : children}
      </ToastProvider>
    </QueryClientProvider>
  )
}
