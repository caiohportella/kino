'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { AuthPanel } from '@/components/auth/auth-panel'
import { useAuthStore } from '@/stores/auth-store'

export default function RegisterPage() {
  const router = useRouter()
  const resolution = useAuthStore((state) => state.resolution)

  useEffect(() => {
    if (resolution.status === 'authenticated') router.replace('/discover')
  }, [resolution.status, router])

  return (
    <div className="content-frame grid min-h-[calc(100vh-68px)] place-items-center py-8">
      <div className="w-full max-w-110">
        <AuthPanel initialTab="register" />
      </div>
    </div>
  )
}
