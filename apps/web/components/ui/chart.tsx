'use client'

import { Slot } from '@radix-ui/react-slot'
import * as React from 'react'
import {
  CartesianGrid,
  Label,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  type TooltipProps,
} from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { cn } from '@/lib/utils'

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    color?: string
    icon?: React.ComponentType<{ className?: string }>
  }
>

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) throw new Error('Chart components must be used inside ChartContainer.')
  return context
}

function ChartContainer({
  className,
  config,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig
}) {
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        className={cn('relative w-full min-h-50', className)}
        style={
          {
            '--color-primary': 'var(--chart-1)',
            ...Object.fromEntries(
              Object.entries(config).map(([key, value]) => [
                `--color-${key}`,
                value.color ?? `var(--chart-1)`,
              ])
            ),
          } as React.CSSProperties
        }
        {...props}
      >
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

function ChartTooltip({
  content,
  ...props
}: React.ComponentProps<typeof Tooltip> & {
  content?: React.ReactNode
}) {
  return (
    <Tooltip
      content={content ?? <ChartTooltipContent />}
      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
      {...props}
    />
  )
}

function ChartTooltipContent({
  active,
  payload,
  label,
  labelKey,
  nameKey,
  hideLabel,
  hideIndicator,
  indicator = 'dot',
  formatter,
  ...props
}: React.ComponentProps<'div'> & {
  active?: boolean
  payload?: TooltipContentProps<ValueType, NameType>['payload']
  label?: string | number
  labelKey?: string
  nameKey?: string
  hideLabel?: boolean
  hideIndicator?: boolean
  indicator?: 'line' | 'dot' | 'dashed'
  formatter?: TooltipProps<ValueType, NameType>['formatter']
}) {
  const { config } = useChart()
  if (!active || !payload?.length) return null

  const item = payload[0]
  const dataKey = String(item?.dataKey ?? nameKey ?? '')
  const entry = config[dataKey] ?? {}
  const value =
    formatter && item
      ? formatter(item.value as ValueType, item.name as NameType, item, 0, payload)
      : item?.value

  return (
    <div
      className={cn(
        'grid min-w-40 gap-1.5 rounded-md border border-white/10 bg-kino-panel px-3 py-2 text-sm shadow-soft',
        props.className
      )}
    >
      {!hideLabel ? (
        <div className="text-xs font-medium uppercase tracking-[0.16em] text-kino-muted">
          {labelKey ? (config[labelKey]?.label ?? label) : label}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        {!hideIndicator ? (
          <span
            aria-hidden="true"
            className={cn(
              'inline-flex size-2.5 shrink-0 rounded-full` bg-(--color-primary)',
              indicator === 'line' && 'h-1.5 w-4 rounded-full',
              indicator === 'dashed' &&
                'h-1.5 w-4 rounded-full border border-dashed border-current bg-transparent'
            )}
            style={{
              backgroundColor: item?.color || entry.color || 'var(--chart-1)',
            }}
          />
        ) : null}
        <span className="font-medium text-kino-text">
          {entry.label ??
            item?.name ??
            (typeof item?.dataKey === 'string' || typeof item?.dataKey === 'number'
              ? item.dataKey
              : '')}
        </span>
        <span className="ml-auto font-semibold text-kino-text">{value as React.ReactNode}</span>
      </div>
    </div>
  )
}

function ChartLegend(props: React.ComponentProps<typeof Legend>) {
  return <Legend {...props} />
}

function ChartLegendContent({
  payload,
  nameKey,
  className,
}: React.ComponentProps<'div'> & {
  payload?: readonly unknown[]
  nameKey?: string
}) {
  const { config } = useChart()
  if (!payload?.length) return null

  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-4 text-sm', className)}>
      {payload.map((entry) => {
        const item = entry as {
          value?: string
          color?: string
          dataKey?: string
        }
        const key = nameKey ? (item.value ?? '') : (item.dataKey ?? '')
        const configEntry = config[key] ?? {}
        return (
          <div key={key} className="flex items-center gap-2 text-kino-muted">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{
                backgroundColor: item.color || configEntry.color || 'var(--chart-1)',
              }}
            />
            <span>{configEntry.label ?? item.value ?? item.dataKey}</span>
          </div>
        )
      })}
    </div>
  )
}

function ChartStyle() {
  const { config } = useChart()
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(config)
          .map(([key, value]) => `:root{--color-${key}:${value.color ?? 'var(--chart-1)'};}`)
          .join('\n'),
      }}
    />
  )
}

function ChartPolarGrid(props: React.ComponentProps<typeof CartesianGrid>) {
  return <CartesianGrid {...props} />
}

function ChartPolarRadiusAxis(props: React.ComponentProps<typeof Label>) {
  return <Label {...props} />
}

const ChartCard = Slot

export {
  ChartCard,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartPolarGrid,
  ChartPolarRadiusAxis,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
}
