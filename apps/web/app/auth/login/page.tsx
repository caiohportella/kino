'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AuthPanel } from '@/components/auth/auth-panel'
import { consentPath } from '@/lib/ai/continuation'
import { useAuthStore } from '@/stores/auth-store'

export default function LoginPage() {
  const router = useRouter()
  const resolution = useAuthStore((state) => state.resolution)
  const [continuation, setContinuation] = useState<string | null>()

  useEffect(() => {
    setContinuation(consentPath(new URLSearchParams(window.location.search).get('ai_flow')))
  }, [])
  useEffect(() => {
    if (continuation !== undefined && resolution.status === 'authenticated')
      router.replace(continuation ?? '/discover')
  }, [continuation, resolution.status, router])

  return (
    <div className="content-frame grid min-h-[calc(100vh-68px)] place-items-center py-8">
      <div className="w-full max-w-110">
        <AuthPanel initialTab="sign-in" aiContinuation={continuation ?? undefined} />
      </div>
    </div>
  )
}
