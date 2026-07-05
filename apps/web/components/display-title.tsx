import { cn } from '@/lib/utils'

export function DisplayTitle({ title, className }: { title: string; className?: string }) {
  const normalizedTitle = title.trim()
  const titleWithoutPeriod = normalizedTitle.endsWith('.') ? normalizedTitle.slice(0, -1) : normalizedTitle

  return (
    <span className={cn('text-kino-text', className)}>
      {titleWithoutPeriod}
      <span className="text-kino-accent">.</span>
    </span>
  )
}
