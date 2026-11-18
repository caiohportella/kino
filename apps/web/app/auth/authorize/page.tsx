import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { consentPath, flowCookie } from '@/lib/ai/continuation'
import { loadBrowserConsent } from '@/lib/ai/oauth'
import { ConsentScreen } from './consent-screen'

export const metadata: Metadata = {
  title: 'Connect your Kino account',
  referrer: 'same-origin',
  robots: { index: false },
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string }>
}) {
  const { flow } = await searchParams
  if (!flow || !consentPath(flow)) return <ConsentScreen flow="" client={null} />
  const proof = (await cookies()).get(flowCookie(flow))?.value
  const result = await loadBrowserConsent(flow, proof)
  if (result.login) redirect(result.login)
  return <ConsentScreen flow={flow} client={result.client ?? null} />
}
