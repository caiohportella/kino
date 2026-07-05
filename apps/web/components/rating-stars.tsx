'use client'

import { Star } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

type RatingSize = 'sm' | 'md' | 'lg'

const sizeMap: Record<RatingSize, number> = {
  sm: 18,
  md: 28,
  lg: 38,
}

export function RatingStars({
  value,
  onChange,
  readonly = false,
  disabled = false,
  size = 'md',
  className,
  label = 'Rating',
}: {
  value: number
  onChange?: (value: number) => void
  readonly?: boolean
  disabled?: boolean
  size?: RatingSize
  className?: string
  label?: string
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const displayValue = hovered ?? value
  const starSize = sizeMap[size]
  const interactive = Boolean(onChange) && !readonly

  function setRating(nextValue: number) {
    if (disabled || readonly || !onChange) return
    onChange(Math.max(0, Math.min(5, nextValue)))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault()
      setRating(value >= 5 ? 5 : value + 0.5)
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault()
      setRating(value <= 0 ? 0 : value - 0.5)
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setRating(0.5)
    }
    if (event.key === 'End') {
      event.preventDefault()
      setRating(5)
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      setRating(0)
    }
  }

  return (
    <div
      aria-label={`${label}: ${value ? `${value} out of 5` : 'not rated'}`}
      className={cn('inline-flex items-center gap-1.5', className)}
      onMouseLeave={() => setHovered(null)}
      role={interactive ? 'radiogroup' : 'img'}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fillPercent = Math.max(0, Math.min(1, displayValue - (star - 1))) * 100

        return (
          <span className="relative inline-grid shrink-0 place-items-center" key={star} style={{ height: starSize, width: starSize }}>
            <Star
              aria-hidden="true"
              className="absolute inset-0 text-white/20"
              fill="transparent"
              size={starSize}
              strokeWidth={1.8}
            />
            <span aria-hidden="true" className="absolute inset-0 overflow-hidden" style={{ width: `${fillPercent}%` }}>
              <Star
                className="text-kino-accent"
                fill="currentColor"
                size={starSize}
                strokeWidth={1.8}
              />
            </span>
            {interactive ? (
              <>
                <button
                  aria-checked={value === star - 0.5}
                  aria-label={`${star - 0.5} stars`}
                  className="absolute inset-y-0 left-0 z-10 w-1/2 rounded-l-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kino-accent disabled:cursor-not-allowed"
                  disabled={disabled}
                  onClick={() => setRating(star - 0.5)}
                  onFocus={() => setHovered(star - 0.5)}
                  onKeyDown={handleKeyDown}
                  onMouseEnter={() => setHovered(star - 0.5)}
                  role="radio"
                  tabIndex={star === Math.max(1, Math.ceil(value || 1)) ? 0 : -1}
                  type="button"
                />
                <button
                  aria-checked={value === star}
                  aria-label={`${star} stars`}
                  className="absolute inset-y-0 right-0 z-10 w-1/2 rounded-r-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kino-accent disabled:cursor-not-allowed"
                  disabled={disabled}
                  onClick={() => setRating(star)}
                  onFocus={() => setHovered(star)}
                  onKeyDown={handleKeyDown}
                  onMouseEnter={() => setHovered(star)}
                  role="radio"
                  tabIndex={value === star ? 0 : -1}
                  type="button"
                />
              </>
            ) : null}
          </span>
        )
      })}
    </div>
  )
}
