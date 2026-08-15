import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function TitleSection({
  children,
  className,
  title,
}: {
  children: ReactNode
  className?: string
  title?: ReactNode
}) {
  return (
    <section
      className={cn(
        'grid gap-4 border-t border-white/[0.07] py-6 first:border-t-0 first:pt-0',
        className
      )}
    >
      {title ? <h2 className="text-sm font-semibold text-kino-text">{title}</h2> : null}
      {children}
    </section>
  )
}
