import type { CSSProperties } from 'react'

import { KINO_LOGO_PATH } from '@/lib/brand'
import { cn } from '@/lib/utils'

interface KinoLogoProps {
  variant?: 'compact' | 'full'
  className?: string
  style?: CSSProperties
  priority?: boolean
  label?: string
  src?: string
  renderMode?: 'image' | 'og'
}

export function KinoLogo({
  variant = 'full',
  className,
  style,
  priority = false,
  label = 'Kino',
  src = KINO_LOGO_PATH,
  renderMode = 'image',
}: KinoLogoProps) {
  return (
    <span
      className={cn(
        'block shrink-0 overflow-hidden',
        'aspect-3/2',
        variant === 'compact' ? 'w-11' : 'w-24',
        className
      )}
      style={style}
    >
      <img
        alt={label}
        className={cn('block size-full object-contain', variant === 'compact' && 'scale-200')}
        decoding={renderMode === 'og' ? undefined : 'async'}
        height={1024}
        loading={priority ? 'eager' : 'lazy'}
        src={src}
        width={1536}
      />
    </span>
  )
}
