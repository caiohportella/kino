'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AuthPanel } from '@/components/auth-panel'
import { useAuthStore } from '@/stores/auth-store'

export default function RegisterPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    if (user) router.replace('/discover')
  }, [router, user])

  return (
    <div className="content-frame grid min-h-[calc(100vh-68px)] place-items-center py-8">
      <div className="w-full max-w-[440px]">
        <AuthPanel initialTab="register" />
      </div>
    </div>
  )
}
