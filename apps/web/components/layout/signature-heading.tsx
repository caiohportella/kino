import type { ReactNode } from 'react'
import { DisplayTitle } from '@/components/media/display-title'
import { cn } from '@/lib/utils'

export function SignatureHeading({
  desktopTitle,
  mobileTitle,
  body,
  action,
  className,
}: {
  desktopTitle: string
  mobileTitle: string
  body?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between',
        className
      )}
    >
      <div className="min-w-0 max-w-4xl">
        <h1 className="wrap-break-word text-2xl font-black italic leading-[1.05] tracking-normal md:text-3xl lg:text-4xl">
          <span className="md:hidden">
            <DisplayTitle title={mobileTitle} />
          </span>

          <span className="hidden md:inline">
            <DisplayTitle title={desktopTitle} />
          </span>
        </h1>

        {body ? <p className="mt-3 max-w-2xl text-sm leading-6 text-kino-muted">{body}</p> : null}
      </div>

      {action ? (
        <div className="flex max-w-full flex-wrap items-center gap-3 md:shrink-0">{action}</div>
      ) : null}
    </header>
  )
}
