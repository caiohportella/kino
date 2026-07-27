import { Skeleton } from '@/components/ui/skeleton'

export function ProfileReviewSkeleton() {
  return (
    <div aria-hidden="true" className="grid grid-cols-[72px_minmax(0,1fr)] gap-4 rounded-md border border-white/10 bg-white/[0.025] p-4">
      <Skeleton className="aspect-[2/3] w-[72px] rounded" />
      <div className="grid content-start gap-3">
        <Skeleton className="h-4 w-2/3" />
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-28" />
      </div>
    </div>
  )
}
