import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { getComparisonTone, type PreviousMonthComparisonRow } from '@/lib/monthly-comparison'

type PreviousMonthCardProps = {
  title: string
  rows: PreviousMonthComparisonRow[]
  hasActivity: boolean
  emptyLabel: string
}

export function PreviousMonthCard({
  title,
  rows,
  hasActivity,
  emptyLabel,
}: PreviousMonthCardProps) {
  return (
    <Card className="gap-0 rounded-xl border-white/10 bg-kino-surface p-0 shadow-none">
      <CardHeader className="gap-1 px-6 pt-6">
        <CardTitle className="text-sm font-bold text-kino-text">{title}</CardTitle>
      </CardHeader>

      <CardContent className="px-6 pb-6 pt-3">
        {hasActivity ? (
          <div>
            {rows.map((row, index) => (
              <div key={row.id}>
                {index > 0 ? <Separator /> : null}

                <ComparisonRow delta={row.delta} label={row.label} value={row.value} />
              </div>
            ))}
          </div>
        ) : (
          <p className="py-2 text-sm text-kino-muted">{emptyLabel}</p>
        )}
      </CardContent>
    </Card>
  )
}

function ComparisonRow({ label, value, delta }: { label: string; value: string; delta: number }) {
  const tone = getComparisonTone(delta)
  const Icon = tone === 'positive' ? ArrowUp : tone === 'negative' ? ArrowDown : Minus
  const valueClassName =
    tone === 'positive'
      ? 'text-kino-accent'
      : tone === 'negative'
        ? 'text-kino-muted/80'
        : 'text-kino-muted'
  const iconClassName = valueClassName

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm text-kino-muted">{label}</span>

      <span className="flex items-center gap-2 text-right text-sm font-semibold text-kino-text">
        <Icon aria-hidden="true" className={iconClassName} size={14} />

        <span className={valueClassName}>{value}</span>
      </span>
    </div>
  )
}
