import { redirect } from 'next/navigation'
import { authPreference, browserUser } from '@/lib/ai/oauth'
import { IntegrationSettings } from './integration-form'

export default async function IntegrationPage() {
  const user = await browserUser()
  if (!user) redirect('/auth/login')
  const enabled = await authPreference(user.id).catch(() => null)
  return <IntegrationSettings initial={enabled} />
}
