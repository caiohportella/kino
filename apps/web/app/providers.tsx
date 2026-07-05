'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { createQueryClient } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'
import { ServiceWorkerRegister } from '@/components/service-worker-register'
import { ToastProvider } from '@/components/toast-provider'

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
