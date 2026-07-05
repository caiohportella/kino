import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

type Tone = 'primary' | 'secondary' | 'danger' | 'ghost'

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function Button({
  className,
  tone = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      className={cn(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kino-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'primary' && 'bg-kino-accent text-black hover:bg-kino-accent-strong',
        tone === 'secondary' && 'border border-white/10 bg-white/[0.06] text-kino-text hover:bg-white/[0.1]',
        tone === 'danger' && 'border border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20',
        tone === 'ghost' && 'bg-transparent text-kino-muted hover:bg-white/[0.06]',
        className
      )}
      type={props.type || 'button'}
      {...props}
    />
  )
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.05] text-kino-muted transition-colors hover:bg-white/[0.09] hover:text-kino-text',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kino-accent',
        className
      )}
      type={props.type || 'button'}
      {...props}
    >
      {children}
    </button>
  )
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-md border border-white/10 bg-kino-surface', className)} {...props} />
}

export function Field({
  label,
  help,
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string
  help?: string
  error?: string
}) {
  const description = error || help
  return (
    <label className={cn('grid gap-2 text-sm', className)}>
      <span className="font-semibold text-kino-text">{label}</span>
      <input
        className={cn(
          'min-h-10 rounded-md border bg-kino-panel px-3 text-kino-text outline-none transition-colors placeholder:text-kino-muted/60',
          error ? 'border-red-400/70' : 'border-white/10 focus:border-kino-accent'
        )}
        {...props}
      />
      {description ? (
        <span className={cn('text-xs', error ? 'text-red-300' : 'text-kino-muted')}>{description}</span>
      ) : null}
    </label>
  )
}

export function TextArea({
  label,
  help,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; help?: string }) {
  return (
    <label className={cn('grid gap-2 text-sm', className)}>
      <span className="font-semibold text-kino-text">{label}</span>
      <textarea
        className="min-h-28 rounded-md border border-white/10 bg-kino-panel px-3 py-3 text-kino-text outline-none transition-colors placeholder:text-kino-muted/60 focus:border-kino-accent"
        {...props}
      />
      {help ? <span className="text-xs text-kino-muted">{help}</span> : null}
    </label>
  )
}

export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string
  body: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mx-auto grid max-w-md gap-3 rounded-md border border-white/10 bg-kino-surface px-5 py-8 text-left',
        className
      )}
    >
      <h2 className="text-xl font-semibold text-kino-text">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-kino-muted">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}

export function Poster({
  src,
  title,
  className,
  children,
}: {
  src: string | null | undefined
  title: string
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('relative aspect-[2/3] w-full overflow-hidden rounded bg-white/[0.06]', className)}>
      {src ? (
        <img
          alt={title}
          className="h-full w-full object-cover"
          loading="lazy"
          src={src}
        />
      ) : (
        <div className="grid h-full place-items-center px-3 text-center text-xs font-semibold text-kino-muted">
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const normalized = Math.max(0, Math.min(100, value))
  return (
    <div className="grid gap-2">
      {label ? <div className="text-xs font-semibold text-kino-muted">{label}</div> : null}
      <div className="h-1.5 overflow-hidden rounded-sm bg-white/10">
        <div className="h-full rounded-sm bg-kino-accent" style={{ width: `${normalized}%` }} />
      </div>
    </div>
  )
}

export function RatingStars({
  value,
  onChange,
  size = 'md',
  readonly = false,
}: {
  value: number
  onChange?: (value: number) => void
  size?: 'sm' | 'md' | 'lg'
  readonly?: boolean
}) {
  const starClass = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-sm' : 'text-xl'

  return (
    <div aria-label={`Rating ${value} out of 5`} className="inline-flex items-center gap-1" role="img">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = value >= star
        if (readonly) {
          return (
            <span key={star} className={cn(starClass, active ? 'text-kino-accent' : 'text-white/20')}>
              *
            </span>
          )
        }

        return (
          <button
            aria-label={`Set rating ${star}`}
            className={cn(
              starClass,
              'leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kino-accent',
              active ? 'text-kino-accent' : 'text-white/20'
            )}
            key={star}
            onClick={() => onChange?.(star)}
            type="button"
          >
            *
          </button>
        )
      })}
    </div>
  )
}

export function Dialog({
  title,
  open,
  onClose,
  children,
}: {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="presentation">
      <section
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-md border border-white/10 bg-kino-panel p-5 shadow-soft"
        role="dialog"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-kino-text">{title}</h2>
          <button
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-md text-kino-muted hover:bg-white/[0.06] hover:text-kino-text"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] px-4 py-3">
      <div className="text-2xl font-semibold text-kino-text">{value}</div>
      <div className="mt-1 text-xs font-medium text-kino-muted">{label}</div>
    </div>
  )
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { label: string; value: T }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="inline-flex rounded-md border border-white/10 bg-kino-panel p-1">
      {options.map((option) => (
        <button
          className={cn(
            'min-h-9 rounded-sm px-3 text-sm font-semibold transition-colors',
            value === option.value ? 'bg-kino-accent text-black' : 'text-kino-muted hover:bg-white/[0.06]'
          )}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
