import { Skeleton } from '@/components/ui/skeleton'

export function ReviewSkeleton() {
  return (
    <div aria-hidden="true" className="flex gap-3">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="grid flex-1 gap-3">
        <div className="flex gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-4 w-4/5 max-w-lg" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  )
}
