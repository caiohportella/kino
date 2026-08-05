import { cn } from '@/lib/utils'

export function CarouselArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next'
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      aria-label={direction === 'prev' ? 'Previous' : 'Next'}
      className={cn(
        'absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white opacity-0 backdrop-blur-md transition-all duration-200 hover:bg-black/50 group-hover/carousel:opacity-100 focus-visible:opacity-100',
        direction === 'prev' ? 'left-4' : 'right-4',
        disabled && 'pointer-events-none opacity-0!'
      )}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault()
        onClick()
      }}
      type="button"
    >
      <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
        <path
          d={direction === 'prev' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </button>
  )
}
