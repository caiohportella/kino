"use client";

import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { RatingStars } from "@/components/rating-stars";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type DiaryFilterState = {
  rating: string;
  watchType: string;
  year: string;
  decade: string;
  genre: string;
  sort: string;
};

type FilterOption = { label: string; value: string };

type DiaryFiltersProps = {
  activeCount: number;
  genres: FilterOption[];
  onChange: (key: keyof DiaryFilterState, value: string) => void;
  onReset: () => void;
  state: DiaryFilterState;
  years: string[];
};

const DECADES = Array.from({ length: 13 }, (_, index) =>
  String(2020 - index * 10),
);

const SORT_GROUPS = [
  { key: "watchedDate", values: ["watched-desc", "watched-asc"] },
  { key: "reviewActivity", values: ["activity-desc", "activity-asc"] },
  { key: "diaryCount", values: ["count-desc", "count-asc"] },
  { key: "titleName", values: ["title-asc", "title-desc"] },
  { key: "popularity", values: ["popularity-desc", "popularity-asc"] },
  { key: "releaseDate", values: ["release-desc", "release-asc"] },
  { key: "averageRating", values: ["average-desc", "average-asc"] },
  { key: "userRating", values: ["rating-desc", "rating-asc"] },
  { key: "runtime", values: ["runtime-desc", "runtime-asc"] },
] as const;

export function DiaryFilters({
  activeCount,
  genres,
  onChange,
  onReset,
  state,
  years,
}: DiaryFiltersProps) {
  const { t } = useTranslation();

  const yearOptions = [
    { label: t("diaryFilters.anyYear"), value: "any" },
    ...years.map((year) => ({ label: year, value: year })),
  ];
  const decadeOptions = [
    { label: t("diaryFilters.anyDecade"), value: "any" },
    ...DECADES.map((decade) => ({ label: `${decade}s`, value: decade })),
  ];
  const genreOptions = [
    { label: t("diaryFilters.anyGenre"), value: "any" },
    ...genres,
  ];
  const sortOptions = SORT_GROUPS.flatMap((group) =>
    group.values.map((value) => ({
      label: t(`diaryFilters.sortOptions.${value}`),
      value,
    })),
  );

  const controls = (
    <>
      <RatingFilterDropdown
        onChange={(value) => onChange("rating", value)}
        value={state.rating}
      />
      <FilterDropdown
        label={t("diaryFilters.watchType")}
        onChange={(value) => onChange("watchType", value)}
        options={[
          { label: t("diaryFilters.anyWatchType"), value: "any" },
          { label: t("diary.firstTime"), value: "first-time" },
          { label: t("diary.rewatch"), value: "rewatch" },
        ]}
        value={state.watchType}
      />
      <FilterDropdown
        label={t("diaryFilters.diaryYear")}
        onChange={(value) => onChange("year", value)}
        options={yearOptions}
        value={state.year}
      />
      <FilterDropdown
        label={t("diaryFilters.decade")}
        onChange={(value) => onChange("decade", value)}
        options={decadeOptions}
        value={state.decade}
      />
      <FilterDropdown
        label={t("diaryFilters.genre")}
        onChange={(value) => onChange("genre", value)}
        options={genreOptions}
        value={state.genre}
      />
      <SortDropdown
        onChange={(value) => onChange("sort", value)}
        options={sortOptions}
        value={state.sort}
      />
    </>
  );

  return (
    <div className="mb-6 flex items-center gap-2">
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        {controls}
      </div>

      <Dialog>
        <DialogTrigger
          render={
            <Button className="md:hidden" size="sm" variant="secondary">
              <SlidersHorizontal data-icon="inline-start" />
              {t("diaryFilters.filters")}
              {activeCount > 0 ? (
                <span
                  aria-label={t("diaryFilters.activeCount", {
                    count: activeCount,
                  })}
                >
                  {activeCount}
                </span>
              ) : null}
            </Button>
          }
        ></DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("diaryFilters.filters")}</DialogTitle>
            <DialogDescription>
              {t("diaryFilters.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">{controls}</div>
          {activeCount > 0 ? (
            <Button
              className="hover:bg-transparent"
              onClick={onReset}
              variant="ghost"
            >
              <RotateCcw data-icon="inline-start" />
              {t("diaryFilters.reset")}
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>

      {activeCount > 0 ? (
        <Button
          className="hidden hover:bg-transparent md:inline-flex"
          onClick={onReset}
          size="sm"
          variant="ghost"
        >
          <RotateCcw data-icon="inline-start" />
          {t("diaryFilters.reset")}
        </Button>
      ) : null}
    </div>
  );
}

function RatingFilterDropdown({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  const { t } = useTranslation();
  const numericValue =
    value !== "any" && value !== "unrated" ? Number(value) : 0;
  const selectedLabel =
    value === "any"
      ? t("diaryFilters.rating")
      : value === "unrated"
        ? t("diaryFilters.noRating")
        : t("diaryFilters.stars", { count: value });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`${t("diaryFilters.rating")}: ${selectedLabel}`}
            className={cn(
              "w-full justify-between md:w-auto",
              value !== "any" &&
                "border-kino-accent bg-kino-accent text-white hover:border-kino-accent-strong hover:bg-kino-accent-strong hover:text-white",
            )}
            size="sm"
            variant={value === "any" ? "secondary" : "outline"}
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronDown data-icon="inline-end" />
          </Button>
        }
      ></DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t("diaryFilters.rating")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup onValueChange={onChange} value={value}>
          <DropdownMenuRadioItem value="any">
            {t("diaryFilters.anyRating")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="unrated">
            {t("diaryFilters.noRating")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <div className="grid justify-center gap-2 px-3 py-3">
          <RatingStars
            label={t("diaryFilters.rating")}
            onChange={(rating) => onChange(String(rating))}
            size="md"
            value={numericValue}
          />
          <span className="text-center text-xs font-semibold text-kino-muted">
            {numericValue > 0
              ? t("diaryFilters.stars", { count: numericValue })
              : t("diaryFilters.chooseRating")}
          </span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FilterDropdown({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  value: string;
}) {
  const selected =
    options.find((option) => option.value === value) ?? options[0]!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className={cn(
              "w-full justify-between md:w-auto",
              value !== "any" &&
                "border-kino-accent bg-kino-accent text-white hover:border-kino-accent-strong hover:bg-kino-accent-strong hover:text-white",
            )}
            size="sm"
            variant={value === "any" ? "secondary" : "outline"}
          >
            <span className="truncate">
              {value === "any" ? label : selected.label}
            </span>
            <ChevronDown data-icon="inline-end" />
          </Button>
        }
      ></DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup onValueChange={onChange} value={value}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SortDropdown({
  onChange,
  options,
  value,
}: {
  onChange: (value: string) => void;
  options: FilterOption[];
  value: string;
}) {
  const { t } = useTranslation();
  const selected =
    options.find((option) => option.value === value) ?? options[0]!;
  const selectedGroup = SORT_GROUPS.find((group) =>
    group.values.some((sortValue) => sortValue === value),
  );
  const selectedLabel = selectedGroup
    ? `${t(`diaryFilters.sortGroups.${selectedGroup.key}`)}: ${selected.label}`
    : selected.label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className={cn(
              "w-full justify-between md:w-auto",
              value !== "watched-desc" &&
                "border-kino-accent bg-kino-accent text-white hover:border-kino-accent-strong hover:bg-kino-accent-strong hover:text-white",
            )}
            size="sm"
            variant="secondary"
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronDown data-icon="inline-end" />
          </Button>
        }
      ></DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 overflow-y-auto">
        <DropdownMenuRadioGroup onValueChange={onChange} value={value}>
          {SORT_GROUPS.map((group, index) => (
            <div key={group.key}>
              {index > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuLabel>
                {t(`diaryFilters.sortGroups.${group.key}`)}
              </DropdownMenuLabel>
              {group.values.map((sortValue) => (
                <DropdownMenuRadioItem key={sortValue} value={sortValue}>
                  {options.find((option) => option.value === sortValue)?.label}
                </DropdownMenuRadioItem>
              ))}
            </div>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
