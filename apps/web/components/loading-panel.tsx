export function LoadingPanel({ label = 'Loading Kino...' }: { label?: string }) {
  return (
    <div className="grid min-h-[320px] place-items-center">
      <div className="grid place-items-center gap-4 text-kino-muted">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-kino-accent" />
        <p className="text-sm font-semibold">{label}</p>
      </div>
    </div>
  )
}
