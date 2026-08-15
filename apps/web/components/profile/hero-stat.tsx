export function HeroStat({
  label,
  value,
  locale,
}: {
  label: string
  value: number
  locale: string
}) {
  return (
    <div className="sm:border-l sm:border-white/10 sm:px-6 sm:first:border-l-0 sm:first:pl-0">
      <div className="text-xl font-bold text-kino-text">
        {new Intl.NumberFormat(locale).format(value)}
      </div>

      <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-kino-muted">
        {label}
      </div>
    </div>
  )
}
