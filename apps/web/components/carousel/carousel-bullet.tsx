import type { CarouselTitle } from '@kino/core'
import { getDisplayTitle } from '@kino/core'

export function CarouselBullet({
  active,
  item,
  progress,
  onClick,
}: {
  active: boolean
  item: CarouselTitle
  progress: number
  onClick: () => void
}) {
  const color = item.paletteColor ?? '#ffffff'
  return (
    <button
      aria-current={active ? 'true' : undefined}
      aria-label={getDisplayTitle(item)}
      className="group/bullet relative h-5 min-w-0 flex-1"
      onClick={onClick}
      type="button"
    >
      <span
        className="
          absolute inset-x-0 top-1/2
          h-0.5 -translate-y-1/2
          overflow-hidden rounded-full
          bg-white/20
          transition-colors
          group-hover/bullet:bg-white/30
        "
      >
        {active ? (
          <span
            className="absolute inset-0 origin-left rounded-full"
            style={{
              backgroundColor: color,
              boxShadow: `0 0 8px ${color}60`,
              transform: `scaleX(${progress})`,
            }}
          />
        ) : null}
      </span>
    </button>
  )
}
