'use client'

import { Skeleton } from '@/components/ui/skeleton'

export function ActivityFeedSkeleton({ count = 5, label }: { count?: number; label?: string }) {
  return (
    <div aria-busy="true" className="grid gap-3">
      {label ? <span className="sr-only">{label}</span> : null}
      {Array.from({ length: count }).map((_, index) => (
        <ActivityFeedSkeletonItem key={`activity-skeleton-${index}`} />
      ))}
    </div>
  )
}

function ActivityFeedSkeletonItem() {
  return (
    <article className="grid grid-cols-[80px_minmax(0,1fr)] gap-4 rounded-md border border-white/10 bg-white/3 p-4 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-5 sm:p-5">
      <Skeleton className="aspect-2/3 w-20 rounded-md sm:w-24" />

      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-3.5 w-[82%] max-w-96" />
            <Skeleton className="h-3.5 w-[72%] max-w-80" />
          </div>
        </div>

        <div className="mt-3 space-y-3">
          <Skeleton className="h-5 w-2/3 max-w-64" />
          <Skeleton className="h-3.5 w-20" />
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-[92%]" />
            <Skeleton className="h-3.5 w-[78%]" />
          </div>
        </div>
      </div>
    </article>
  )
}
