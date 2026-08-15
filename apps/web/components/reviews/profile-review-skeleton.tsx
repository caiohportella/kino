import { Skeleton } from '@/components/ui/skeleton'

export function ProfileReviewSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="rounded-md border border-white/10 bg-kino-surface p-4 sm:p-5"
    >
      {/* Media context */}
      <div className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-4">
        <Skeleton className="aspect-2/3 w-full rounded-md" />

        <div className="grid gap-2 pt-1">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      {/* Review */}
      <div className="mt-5 flex min-w-0 items-start gap-3.5 border-t border-white/10 pt-5 sm:gap-4">
        <Skeleton className="size-10 shrink-0 rounded-full sm:size-11" />

        <div className="min-w-0 flex-1">
          {/* Author / date / actions */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>

              {/* Rating */}
              <div className="mt-2 flex gap-1">
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton className="size-3.5 rounded-sm" key={`review-star-${index}`} />
                ))}
              </div>
            </div>

            <Skeleton className="h-8 w-16 rounded-md" />
          </div>

          {/* Review body */}
          <div className="mt-4 grid gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[92%]" />
            <Skeleton className="h-4 w-3/5" />
          </div>

          {/* Likes */}
          <div className="mt-4 border-t border-white/10 pt-3">
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
    </div>
  )
}
