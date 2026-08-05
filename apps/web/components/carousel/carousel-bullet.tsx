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
      aria-current={active ? "true" : undefined}
      aria-label={getDisplayTitle(item)}
      className={`relative h-2 overflow-hidden rounded-full transition-[width] duration-300 ease-out ${
        active ? "w-8" : "w-2"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="absolute inset-0 rounded-full bg-white/20" />
      {active ? (
        <span
          className="absolute inset-0 rounded-full transition-transform duration-300 ease-out"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}80`,
            transformOrigin: "left",
            transform: `scaleX(${progress})`,
          }}
        />
      ) : null}
    </button>
  );
}
