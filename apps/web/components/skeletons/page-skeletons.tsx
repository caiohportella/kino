import { Skeleton } from '@/components/ui/skeleton'

function ScreenReaderLoading({ label }: { label: string }) {
  return <span className="sr-only">{label}</span>
}

function HeadingSkeleton() {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-9 w-56 max-w-[70vw]" />
      <Skeleton className="h-4 w-80 max-w-[85vw]" />
    </div>
  )
}

function PosterRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-flow-col auto-cols-[140px] gap-4 overflow-hidden sm:auto-cols-[168px]">
      {Array.from({ length: count }, (_, index) => (
        <div className="grid gap-3" key={index}>
          <Skeleton className="aspect-[2/3] w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      ))}
    </div>
  )
}

function SectionSkeleton({ titleWidth = 'w-36' }: { titleWidth?: string }) {
  return (
    <section className="grid gap-4">
      <Skeleton className={`h-6 ${titleWidth}`} />
      <PosterRowSkeleton />
    </section>
  )
}

export function HomeSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div aria-busy="true" className="content-frame grid gap-10" role="status">
      <ScreenReaderLoading label={label} />
      <Skeleton className="min-h-[280px] w-full rounded-md sm:min-h-[360px]" />
      <SectionSkeleton titleWidth="w-40" />
      <SectionSkeleton titleWidth="w-52" />
    </div>
  )
}

export function TitleSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div aria-busy="true" className="content-frame grid gap-8" role="status">
      <ScreenReaderLoading label={label} />
      <section className="relative min-h-[520px] overflow-hidden rounded-md border border-white/10">
        <Skeleton className="absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 grid items-end gap-6 p-5 md:grid-cols-[190px_1fr] md:p-8">
          <Skeleton className="hidden aspect-[2/3] w-full md:block" />
          <div className="grid gap-4">
            <Skeleton className="h-12 w-3/5" />
            <Skeleton className="h-4 w-2/5" />
            <div className="flex gap-3">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-28" />
            </div>
          </div>
        </div>
      </section>
      <div className="grid gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <SectionSkeleton titleWidth="w-28" />
      <SectionSkeleton titleWidth="w-44" />
    </div>
  )
}

export function PersonSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div aria-busy="true" className="content-frame grid gap-8" role="status">
      <ScreenReaderLoading label={label} />
      <section className="grid min-h-[420px] content-end gap-5 rounded-md border border-white/10 p-5 md:grid-cols-[160px_1fr] md:items-end md:p-6">
        <Skeleton className="aspect-[2/3] w-32 md:w-full" />
        <div className="grid gap-3">
          <Skeleton className="h-12 w-64 max-w-full" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-80 max-w-full" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
      </section>
      <div className="grid gap-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <SectionSkeleton titleWidth="w-28" />
    </div>
  )
}

export function DiarySkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div aria-busy="true" className="content-frame grid gap-6" role="status">
      <ScreenReaderLoading label={label} />
      <HeadingSkeleton />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton className="h-9 w-28" key={index} />
        ))}
      </div>
      <Skeleton className="h-5 w-24" />
      <div className="grid gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton className="h-28 w-full" key={index} />
        ))}
      </div>
    </div>
  )
}

export function SearchSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div aria-busy="true" className="content-frame grid gap-6" role="status">
      <ScreenReaderLoading label={label} />
      <HeadingSkeleton />
      <Skeleton className="h-11 w-full" />
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div className="hidden gap-3 lg:grid">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton className="h-10 w-full" key={index} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          <PosterRowSkeleton count={4} />
        </div>
      </div>
    </div>
  )
}

export function WatchlistsSkeleton({
  detail = false,
  label = 'Loading',
}: {
  detail?: boolean
  label?: string
}) {
  return (
    <div aria-busy="true" className="content-frame grid gap-6" role="status">
      <ScreenReaderLoading label={label} />
      <HeadingSkeleton />
      {detail ? (
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-28" />
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton className="h-36 w-full" key={index} />
        ))}
      </div>
    </div>
  )
}

export function ProfileSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div aria-busy="true" className="content-frame grid gap-8" role="status">
      <ScreenReaderLoading label={label} />
      <Skeleton className="min-h-[540px] w-full" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton className="h-28" key={index} />
        ))}
      </div>
      <SectionSkeleton titleWidth="w-40" />
      <SectionSkeleton titleWidth="w-36" />
    </div>
  )
}

export function SettingsSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div aria-busy="true" className="content-frame grid max-w-4xl gap-6" role="status">
      <ScreenReaderLoading label={label} />
      <HeadingSkeleton />
      <Skeleton className="h-44 w-full" />
      <div className="grid gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-11 w-full" key={index} />
        ))}
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

export function AuthSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div aria-busy="true" className="grid min-h-screen place-items-center p-5" role="status">
      <ScreenReaderLoading label={label} />
      <div className="grid w-full max-w-md gap-4 rounded-md border border-white/10 p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}

export function MediaModalSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div aria-busy="true" className="grid gap-4 py-2" role="status">
      <ScreenReaderLoading label={label} />
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton className="aspect-video w-full" key={index} />
        ))}
      </div>
    </div>
  )
}
