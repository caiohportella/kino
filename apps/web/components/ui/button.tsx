import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kino-accent disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-kino-accent text-black hover:bg-kino-accent-strong',
        secondary: 'border border-white/10 bg-white/[0.06] text-kino-text hover:bg-white/[0.1]',
        ghost: 'text-kino-muted hover:bg-white/[0.06] hover:text-kino-text',
        destructive: 'border border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20',
        outline: 'border border-white/10 bg-transparent text-kino-text hover:bg-white/[0.06]',
      },
      size: {
        default: 'min-h-10 px-4 py-2',
        sm: 'min-h-9 px-3 py-1.5 text-xs',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
}) {
  const Comp = asChild ? Slot : 'button'
  const buttonType = asChild ? type : type || 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} type={buttonType} {...props} />
}

export { buttonVariants }
