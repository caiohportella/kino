import type { ReactNode } from 'react'
import { DisplayTitle } from '@/components/display-title'
import { cn } from '@/lib/utils'

export function PageHeader({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow?: string
  title: string
  body?: string
  action?: ReactNode
}) {
  const hasBody = Boolean(body)

  return (
    <header
      className={cn(
        'flex flex-col border-b border-white/10 md:flex-row md:items-center md:justify-between',
        hasBody ? 'mb-6 gap-4 pb-5' : 'mb-5 gap-3 pb-4'
      )}
    >
      <div className="min-w-0 max-w-3xl">
        <h1 className="break-words text-3xl font-black italic tracking-normal md:text-4xl">
          <DisplayTitle title={title} />
        </h1>
        {body ? <p className="mt-3 max-w-2xl text-sm leading-6 text-kino-muted">{body}</p> : null}
      </div>
      {action ? (
        <div className="flex max-w-full flex-wrap items-center gap-3 md:shrink-0">{action}</div>
      ) : null}
    </header>
  )
}
