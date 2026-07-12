"use client";

import { useEffect, useRef } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SeasonOption = {
  season_number: number;
};

export function SeasonSelector({
  label,
  onSeasonChange,
  seasons,
  value,
}: {
  label: string;
  onSeasonChange: (season: number) => void;
  seasons: SeasonOption[];
  value: number;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!Number.isFinite(value)) return;

    const list = listRef.current;
    const trigger = activeTriggerRef.current;
    if (!list || !trigger || list.scrollWidth <= list.clientWidth) return;

    const left =
      trigger.offsetLeft - (list.clientWidth - trigger.offsetWidth) / 2;
    list.scrollTo({ behavior: "smooth", left: Math.max(0, left) });
  }, [value]);

  return (
    <Tabs
      onValueChange={(nextValue) => onSeasonChange(Number(nextValue))}
      value={String(value)}
    >
      <TabsList
        aria-label={label}
        className="max-w-full gap-2 flex-nowrap justify-start overflow-x-auto rounded-none bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-x-visible"
        ref={listRef}
      >
        {seasons.map((season) => {
          const isActive = season.season_number === value;

          return (
            <TabsTrigger
              className="shrink-0 rounded-full border border-white/10 bg-white/4 px-4 text-kino-muted hover:border-white/20 hover:text-kino-text focus-visible:border-kino-accent focus-visible:ring-kino-accent/40 data-active:border-kino-accent data-active:bg-kino-accent data-active:text-black"
              key={season.season_number}
              ref={isActive ? activeTriggerRef : undefined}
              value={String(season.season_number)}
            >
              S{season.season_number}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
