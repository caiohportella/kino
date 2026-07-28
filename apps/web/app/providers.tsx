'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useEffect, useState } from 'react'
import { ServiceWorkerRegister } from '@/components/service-worker-register'
import { ToastProvider } from '@/components/toast-provider'
import { createQueryClient } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient())
  const initialize = useAuthStore((state) => state.initialize)
  const language = useSettingsStore((state) => state.language)

  useEffect(() => initialize(), [initialize])
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ServiceWorkerRegister />
        {children}
      </ToastProvider>
    </QueryClientProvider>
  )
}
