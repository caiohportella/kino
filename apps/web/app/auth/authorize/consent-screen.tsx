'use client'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/localization/i18n'

export function ConsentScreen({
  flow,
  client,
}: {
  flow: string
  client: {
    client_name: string
    verified: boolean
    scopes: ('read' | 'write')[]
    enabled: boolean
  } | null
}) {
  const { t } = useTranslation()
  return (
    <main className="content-frame">
      <section className="mx-auto max-w-lg rounded-xl border border-border bg-card p-5 sm:p-8">
        <PageHeader
          title={t('aiIntegration.connect', { defaultValue: 'Connect your Kino account' })}
        />
        {!client ? (
          <p role="alert">
            {t('aiIntegration.requestUnavailable', {
              defaultValue:
                'This authorization request has expired or is unavailable. Start again from your assistant.',
            })}
          </p>
        ) : (
          <>
            <p className="text-sm leading-6">
              {client.verified
                ? t('aiIntegration.clientRequest', {
                    name: client.client_name,
                    defaultValue: '{{name}} wants permission to access your Kino account.',
                  })
                : t('aiIntegration.unverifiedClient', {
                    defaultValue:
                      'An unverified MCP client wants access to your Kino account. Continue only if you recognize the app you opened.',
                  })}
            </p>
            <div className="mt-4 grid gap-3 text-sm">
              {client.scopes.includes('read') && (
                <div>
                  <h2 className="font-semibold">
                    {t('aiIntegration.readTitle', { defaultValue: 'View your Kino activity' })}
                  </h2>
                  <p className="mt-1 text-kino-muted">
                    {t('aiIntegration.readDescription', {
                      defaultValue:
                        'View watchlists, diary entries, ratings, TV progress and viewing history for recommendations.',
                    })}
                  </p>
                </div>
              )}
              {client.scopes.includes('write') && (
                <div>
                  <h2 className="font-semibold">
                    {t('aiIntegration.writeTitle', { defaultValue: 'Make changes when you ask' })}
                  </h2>
                  <p className="mt-1 text-kino-muted">
                    {t('aiIntegration.writeDescription', {
                      defaultValue:
                        'Add titles to watchlists, create private or public lists, log movies and episodes, and record ratings and progress.',
                    })}
                  </p>
                </div>
              )}
            </div>
            {!client.enabled && (
              <p className="mt-5 text-sm text-kino-muted">
                {t('aiIntegration.enablePrompt', {
                  defaultValue:
                    'Enable AI Integration before deciding whether to grant this request.',
                })}
              </p>
            )}
            <form
              action="/oauth/consent"
              method="post"
              className="mt-6 flex flex-wrap gap-3"
              onSubmit={(event) => {
                const zone = event.currentTarget.elements.namedItem('timezone')
                if (zone instanceof HTMLInputElement)
                  zone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
              }}
            >
              <input type="hidden" name="flow" value={flow} />
              <input type="hidden" name="timezone" defaultValue="UTC" />
              <Button type="submit" name="decision" value={client.enabled ? 'approve' : 'enable'}>
                {client.enabled
                  ? t('aiIntegration.allow', { defaultValue: 'Allow access' })
                  : t('aiIntegration.enable', { defaultValue: 'Enable AI Integration' })}
              </Button>
              <Button type="submit" variant="outline" name="decision" value="deny">
                {t('aiIntegration.cancel', { defaultValue: 'Cancel' })}
              </Button>
            </form>
          </>
        )}
      </section>
    </main>
  )
}
