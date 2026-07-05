'use client'

import { Button, Card, Field } from '@kino/ui'
import { Mail } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'

export default function LoginPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const signInWithEmail = useAuthStore((state) => state.signInWithEmail)
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle)
  const signInWithOtp = useAuthStore((state) => state.signInWithOtp)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [magicLink, setMagicLink] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) router.replace('/profile')
  }, [router, user])

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      if (magicLink) {
        await signInWithOtp(email.trim())
        setMessage('Check your inbox for a secure sign-in link.')
      } else {
        await signInWithEmail(email.trim(), password)
        router.replace('/profile')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="content-frame grid min-h-[calc(100vh-64px)] place-items-center">
      <Card className="w-full max-w-md p-6">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold text-kino-text">Welcome back</h1>
          <p className="mt-2 text-sm text-kino-muted">Sign in to sync your diary, watchlists, and ratings.</p>
        </div>

        <div className="grid gap-4">
          <Field
            autoComplete="email"
            label="Email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
          {!magicLink ? (
            <Field
              autoComplete="current-password"
              label="Password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          ) : null}

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {message ? <p className="text-sm text-kino-accent">{message}</p> : null}

          <Button disabled={loading || !email.trim()} onClick={handleSubmit}>
            <Mail size={16} />
            {loading ? 'Working...' : magicLink ? 'Send magic link' : 'Sign in'}
          </Button>
          <Button onClick={() => setMagicLink((value) => !value)} tone="ghost">
            {magicLink ? 'Use password instead' : 'Use a magic link'}
          </Button>
          <Button onClick={() => signInWithGoogle()} tone="secondary">
            Continue with Google
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-kino-muted">
          New to Kino?{' '}
          <Link className="font-semibold text-kino-accent" href="/auth/register">
            Create an account
          </Link>
        </p>
      </Card>
    </div>
  )
}
