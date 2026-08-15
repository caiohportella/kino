'use client'

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'

import { type ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart'

export type ProfileCompositionDatum = {
  label: string
  count: number
  percentage: number
}

export function ProfileCompositionBarChart({
  data,
  countLabel,
  percentageLabel,
  formatCount,
  formatPercentage,
  muted = false,
}: {
  data: ProfileCompositionDatum[]
  countLabel: string
  percentageLabel: string
  formatCount: (value: number) => string
  formatPercentage: (value: number) => string
  muted?: boolean
}) {
  const chartConfig = {
    count: {
      label: countLabel,
      color: muted ? 'rgba(255,255,255,0.35)' : 'var(--chart-2)',
    },
  } satisfies ChartConfig

  return (
    <ChartContainer className="h-36 min-h-0 w-full" config={chartConfig}>
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 38, bottom: 0, left: 0 }}
      >
        <CartesianGrid horizontal={false} strokeOpacity={0.06} />
        <XAxis hide type="number" />
        <YAxis
          axisLine={false}
          dataKey="label"
          tick={{ fill: 'var(--kino-muted)', fontSize: 11 }}
          tickLine={false}
          tickMargin={8}
          type="category"
          width={72}
        />
        <ChartTooltip
          cursor={false}
          content={
            <CompositionTooltip
              countLabel={countLabel}
              formatCount={formatCount}
              formatPercentage={formatPercentage}
              percentageLabel={percentageLabel}
            />
          }
        />
        <Bar dataKey="count" fill="var(--color-count)" radius={[0, 5, 5, 0]}>
          <LabelList
            className="fill-kino-muted"
            dataKey="percentage"
            formatter={(value) => formatPercentage(Number(value ?? 0))}
            position="right"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

function CompositionTooltip({
  active,
  payload,
  countLabel,
  percentageLabel,
  formatCount,
  formatPercentage,
}: {
  active?: boolean
  payload?: Array<{ payload?: ProfileCompositionDatum }>
  countLabel: string
  percentageLabel: string
  formatCount: (value: number) => string
  formatPercentage: (value: number) => string
}) {
  const item = payload?.[0]?.payload
  if (!active || !item) return null

  return (
    <div className="grid min-w-40 gap-1.5 rounded-md border border-white/10 bg-kino-panel px-3 py-2 text-sm shadow-soft">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-kino-muted">
        {item.label}
      </div>
      <div className="grid gap-1 text-xs text-kino-muted">
        <div className="flex items-center justify-between gap-4">
          <span>{countLabel}</span>
          <span className="font-semibold text-kino-text">{formatCount(item.count)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>{percentageLabel}</span>
          <span className="font-semibold text-kino-text">{formatPercentage(item.percentage)}</span>
        </div>
      </div>
    </div>
  )
}
