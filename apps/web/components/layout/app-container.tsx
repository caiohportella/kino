import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type AppContainerProps = {
  children: ReactNode
  className?: string
}

export function AppContainer({ children, className }: AppContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full min-w-0 max-w-[var(--app-shell-max-width)] px-[clamp(16px,2vw,40px)]',
        className
      )}
    >
      {children}
    </div>
  )
}
