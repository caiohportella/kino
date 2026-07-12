'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function SegmentedControl<T extends string>({ value, options, onChange }: { value: T; options: { label: string; value: T }[]; onChange: (value: T) => void }) {
  return <Tabs onValueChange={(nextValue) => onChange(nextValue as T)} value={value}><TabsList>{options.map((option) => <TabsTrigger key={option.value} value={option.value}>{option.label}</TabsTrigger>)}</TabsList></Tabs>
}
