import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  activeClassName,
}: {
  value: T
  options: { label: string; value: T }[]
  onChange: (value: T) => void
  activeClassName?: string
}) {
  return (
    <Tabs onValueChange={(nextValue) => onChange(nextValue as T)} value={value}>
      <TabsList>
        {options.map((option) => (
          <TabsTrigger className={cn(activeClassName)} key={option.value} value={option.value}>
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
