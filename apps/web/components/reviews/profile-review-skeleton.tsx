import { Skeleton } from '@/components/ui/skeleton'

export function ProfileReviewSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="
        grid h-full min-w-0
        grid-cols-[68px_minmax(0,1fr)]
        gap-4 border-r border-white/10
        py-2 pr-5
        sm:grid-cols-[76px_minmax(0,1fr)]
        sm:gap-5 sm:pr-6
      "
    >
      <Skeleton className="aspect-2/3 w-full rounded-md" />

      <div className="flex min-w-0 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-10" />
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-[94%]" />
          <Skeleton className="h-3.5 w-[72%]" />
        </div>

        <Skeleton className="mt-auto h-4 w-20" />
      </div>
    </div>
  )
}
