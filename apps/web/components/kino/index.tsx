import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({
  title,
  body,
  action,
  secondaryAction,
  illustration,
  illustrationLabel = 'An empty cinema scene',
  illustrationMark,
  variant = 'cinema',
  size = 'default',
  className,
}: {
  title: string
  body: string
  action?: ReactNode
  secondaryAction?: ReactNode
  illustration?: ReactNode
  illustrationLabel?: string
  illustrationMark?: ReactNode
  variant?: 'cinema' | 'search' | 'diary' | 'watchlist' | 'profile' | 'community' | 'auth' | 'missing'
  size?: 'compact' | 'default'
  className?: string
}) {
  return (
    <section className={cn('empty-state-enter mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-5 text-center', size === 'compact' ? 'min-h-64 gap-3 py-8' : 'min-h-[420px] gap-4 py-12 sm:py-16', className)}>
      {illustration ?? <EmptyStateArtwork illustrationLabel={illustrationLabel} mark={illustrationMark} size={size} variant={variant} />}
      <div className="grid max-w-lg gap-2">
        <h2 className={cn('font-bold text-kino-text', size === 'compact' ? 'text-lg' : 'text-2xl')}>{title}</h2>
        <p className="text-sm leading-6 text-kino-muted sm:text-base">{body}</p>
      </div>
      {action || secondaryAction ? <div className="mt-2 flex flex-col items-center justify-center gap-2 sm:flex-row">{action}{secondaryAction}</div> : null}
    </section>
  )
}

function EmptyStateArtwork({ illustrationLabel, mark, size, variant }: { illustrationLabel: string; mark?: ReactNode; size: 'compact' | 'default'; variant: 'cinema' | 'search' | 'diary' | 'watchlist' | 'profile' | 'community' | 'auth' | 'missing' }) {
  const marks = { cinema: 'K', search: '?', diary: '+', watchlist: '✓', profile: '•', community: '••', auth: '', missing: '404' }
  return (
    <div aria-label={illustrationLabel} className={cn('empty-state-art relative', size === 'compact' ? 'size-24' : 'size-36')} role="img">
      <div className="absolute inset-2 rounded-full bg-kino-accent/10 blur-xl" />
      <div className="absolute inset-[18%] rounded-full border border-kino-accent/40 bg-kino-panel shadow-[0_12px_32px_rgba(0,0,0,0.28)]">
        <span className="absolute left-[18%] top-[18%] size-[22%] rounded-full border border-white/20 bg-black/50" />
        <span className="absolute right-[18%] top-[18%] size-[22%] rounded-full border border-white/20 bg-black/50" />
        <span className="absolute bottom-[18%] left-[18%] size-[22%] rounded-full border border-white/20 bg-black/50" />
        <span className="absolute bottom-[18%] right-[18%] size-[22%] rounded-full border border-white/20 bg-black/50" />
        <span className="absolute inset-[38%] rounded-full bg-kino-accent" />
      </div>
      <div className="absolute bottom-[4%] right-[3%] grid min-h-8 min-w-8 place-items-center rounded-md border border-kino-accent/50 bg-kino-surface px-2 text-xs font-black text-kino-accent shadow-[0_6px_16px_rgba(0,0,0,0.28)]">
        {mark ?? (variant === 'auth' ? <span aria-hidden="true" className="relative mt-1 block h-3.5 w-4 rounded-sm bg-kino-accent"><span className="absolute -top-2 left-1/2 h-2.5 w-3 -translate-x-1/2 rounded-t-full border-2 border-b-0 border-kino-accent" /><span className="absolute left-1/2 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-kino-surface" /></span> : marks[variant])}
      </div>
      <div className="absolute bottom-[11%] left-[8%] h-1.5 w-[32%] -rotate-6 rounded-full bg-kino-accent/55" />
    </div>
  )
}

export function Poster({ src, title, className, children }: { src: string | null | undefined; title: string; className?: string; children?: ReactNode }) {
  return <div className={cn('relative aspect-[2/3] w-full overflow-hidden rounded bg-white/[0.06]', className)}>{src ? <img alt={title} className="h-full w-full object-cover" loading="lazy" src={src} /> : <div className="grid h-full place-items-center px-3 text-center text-xs font-semibold text-kino-muted">{title}</div>}{children}</div>
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const normalized = Math.max(0, Math.min(100, value))
  return <div className="grid gap-2">{label ? <div className="text-xs font-semibold text-kino-muted">{label}</div> : null}<div className="h-1.5 overflow-hidden rounded-sm bg-white/10"><div className="h-full rounded-sm bg-kino-accent" style={{ width: `${normalized}%` }} /></div></div>
}

export function Stat({ label, value, icon }: { label: string; value: string | number; icon?: ReactNode }) {
  return <div className="rounded-md border border-white/10 bg-white/[0.035] px-4 py-3"><div className="text-2xl font-semibold text-kino-text">{value}</div><div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-kino-muted">{icon}<span>{label}</span></div></div>
}
