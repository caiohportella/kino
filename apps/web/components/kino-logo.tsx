import Image from 'next/image'
import type { CSSProperties } from 'react'

import { KINO_LOGO_ASPECT_RATIO, KINO_LOGO_PATH } from '@/lib/brand'
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
        'relative block shrink-0 overflow-hidden',
        variant === 'compact' ? 'w-11' : 'w-19 sm:w-24 lg:w-30',
        className
      )}
      style={{
        ...(renderMode === 'image' ? { aspectRatio: String(KINO_LOGO_ASPECT_RATIO) } : {}),
        ...style,
      }}
    >
      {renderMode === 'og' ? (
        <img
          alt={label}
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      ) : (
        <Image
          alt={label}
          className={cn('object-contain', variant === 'compact' && 'scale-[2.15]')}
          fill
          priority={priority}
          sizes={
            variant === 'compact'
              ? '44px'
              : '(max-width: 639px) 76px, (max-width: 1023px) 96px, 120px'
          }
          src={src}
        />
      )}
    </span>
  )
}
