import type { ReactNode } from 'react'
import { DisplayTitle } from '@/components/display-title'

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
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-black italic tracking-normal md:text-4xl">
          <DisplayTitle title={title} />
        </h1>
        {body ? <p className="mt-3 max-w-2xl text-sm leading-6 text-kino-muted">{body}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-3">{action}</div> : null}
    </header>
  )
}
