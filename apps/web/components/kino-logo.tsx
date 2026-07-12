import Image from 'next/image'
import { cn } from '@/lib/utils'

interface KinoLogoProps {
  variant?: 'compact' | 'full'
  width?: number
  className?: string
  priority?: boolean
  label?: string
}

export function KinoLogo({
  variant = 'full',
  width = variant === 'compact' ? 44 : 120,
  className,
  priority = false,
  label = 'Kino',
}: KinoLogoProps) {
  const height = Math.round(width * (1024 / 1536))

  return (
    <span
      className={cn('relative block shrink-0 overflow-hidden', className)}
      style={{ width, height }}
    >
      <Image
        alt={label}
        className={cn('object-contain', variant === 'compact' && 'scale-[2.15]')}
        fill
        priority={priority}
        sizes={`${width}px`}
        src="/kino-logo.png"
      />
    </span>
  )
}
