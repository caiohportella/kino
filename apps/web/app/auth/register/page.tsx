'use client'

import { Button, Card, Field } from '@kino/ui'
import Link from 'next/link'
import { useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'

export default function RegisterPage() {
  const signUpWithEmail = useAuthStore((state) => state.signUpWithEmail)
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const passwordError = password && password.length < 8 ? 'Use at least 8 characters.' : undefined

  async function handleRegister() {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      await signUpWithEmail(email.trim(), password)
      setMessage('Check your inbox to verify your Kino account.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="content-frame grid min-h-[calc(100vh-64px)] place-items-center">
      <Card className="w-full max-w-md p-6">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold text-kino-text">Create your Kino</h1>
          <p className="mt-2 text-sm text-kino-muted">Start tracking films, episodes, notes, and shared lists.</p>
        </div>

        <div className="grid gap-4">
          <Field
            autoComplete="email"
            label="Email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
          <Field
            autoComplete="new-password"
            error={passwordError}
            label="Password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {message ? <p className="text-sm text-kino-accent">{message}</p> : null}
          <Button disabled={loading || !email.trim() || password.length < 8} onClick={handleRegister}>
            {loading ? 'Creating...' : 'Create account'}
          </Button>
          <Button onClick={() => signInWithGoogle()} tone="secondary">
            Continue with Google
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-kino-muted">
          Already have an account?{' '}
          <Link className="font-semibold text-kino-accent" href="/auth/login">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  )
}
