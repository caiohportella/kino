'use client'

import { Switch } from '@base-ui/react/switch'
import Link from 'next/link'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { useTranslation } from '@/lib/localization/i18n'

export function IntegrationSettings({ initial }: { initial: boolean | null }) {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState(initial ?? false)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<'saved' | 'error' | null>(null)

  async function update(next: boolean) {
    setPending(true)
    setFeedback(null)
    try {
      const result = await fetch('/oauth/settings', {
        method: 'POST',
        body: new URLSearchParams({ enabled: String(next) }),
      })
      if (!result.ok) throw new Error('Could not save')
      setEnabled(next)
      setFeedback('saved')
    } catch {
      setFeedback('error')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="content-frame">
      <Link href="/settings" className="text-sm text-kino-muted underline underline-offset-4">
        {t('aiIntegration.settings', { defaultValue: 'Settings' })}
      </Link>
      <PageHeader title={t('aiIntegration.title', { defaultValue: 'AI Integration' })} />
      <section className="max-w-xl rounded-xl border border-border bg-card p-5">
        {initial !== null ? (
          <div className="flex items-start justify-between gap-5">
            <div className="grid gap-2">
              <p id="ai-access-label" className="font-semibold">
                {t('aiIntegration.access', { defaultValue: 'Allow AI access' })}
              </p>
              <p id="ai-access-description" className="text-sm leading-6 text-kino-muted">
                {t('aiIntegration.description', {
                  defaultValue:
                    'Allow compatible AI assistants to access Kino with your permission. Turning it off disconnects all assistants.',
                })}
              </p>
              <p role="status" className="text-sm text-kino-muted">
                {pending
                  ? t('aiIntegration.saving', { defaultValue: 'Saving…' })
                  : enabled
                    ? t('aiIntegration.enabled', { defaultValue: 'Enabled' })
                    : t('aiIntegration.disabled', { defaultValue: 'Disabled' })}{' '}
                {feedback === 'saved' &&
                  t('aiIntegration.saved', { defaultValue: 'Changes saved.' })}
              </p>
            </div>
            <Switch.Root
              aria-labelledby="ai-access-label"
              aria-describedby="ai-access-description"
              checked={enabled}
              onCheckedChange={update}
              disabled={pending}
              className="h-7 w-12 shrink-0 rounded-full border border-border bg-muted p-0.5 outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60 data-checked:bg-primary"
            >
              <Switch.Thumb className="block size-5 rounded-full bg-foreground transition-transform motion-reduce:transition-none data-checked:translate-x-5 data-checked:bg-primary-foreground" />
            </Switch.Root>
          </div>
        ) : (
          <p role="alert">
            {t('aiIntegration.unavailable', {
              defaultValue: 'AI Integration is currently unavailable.',
            })}
          </p>
        )}
        {feedback === 'error' && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {t('aiIntegration.saveFailed', { defaultValue: 'Could not save. Try again.' })}
          </p>
        )}
      </section>
    </main>
  )
}
