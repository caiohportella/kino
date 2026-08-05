import type { CarouselTitle } from "@kino/core";
import { getDisplayTitle } from "@kino/core";

export function CarouselBullet({
  active,
  item,
  progress,
  onClick,
}: {
  active: boolean;
  item: CarouselTitle;
  progress: number;
  onClick: () => void;
}) {
  const color = item.paletteColor ?? "#ffffff";

  return (
    <button
      aria-current={active}
      aria-label={getDisplayTitle(item)}
      className="relative h-2 w-8 overflow-hidden rounded-full"
      onClick={onClick}
      type="button"
    >
      <span className="absolute inset-0 rounded-full bg-white/20" />

      <span
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: active ? `0 0 8px ${color}80` : undefined,
          transformOrigin: "left",
          transform: `scaleX(${active ? progress : 0})`,
        }}
      />
    </button>
  );
}
