'use client'

import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function LabeledField({ label, help, error, className, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; help?: string; error?: string }) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const description = error || help
  const descriptionId = description ? `${inputId}-description` : undefined
  return <label className={cn('grid gap-2 text-sm', className)} htmlFor={inputId}><span className="font-semibold text-kino-text">{label}</span><input aria-describedby={descriptionId} aria-invalid={Boolean(error)} className={cn('min-h-10 rounded-md border bg-kino-panel px-3 text-kino-text outline-none transition-colors placeholder:text-kino-muted/60 focus-visible:border-kino-accent focus-visible:ring-3 focus-visible:ring-kino-accent/30', error ? 'border-destructive' : 'border-white/10')} id={inputId} {...props} />{description ? <span className={cn('text-xs', error ? 'text-destructive' : 'text-kino-muted')} id={descriptionId}>{description}</span> : null}</label>
}

export function LabeledTextArea({ label, help, className, id, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; help?: string }) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const descriptionId = help ? `${inputId}-description` : undefined
  return <label className={cn('grid gap-2 text-sm', className)} htmlFor={inputId}><span className="font-semibold text-kino-text">{label}</span><textarea aria-describedby={descriptionId} className="min-h-28 rounded-md border border-white/10 bg-kino-panel px-3 py-3 text-kino-text outline-none transition-colors placeholder:text-kino-muted/60 focus-visible:border-kino-accent focus-visible:ring-3 focus-visible:ring-kino-accent/30" id={inputId} {...props} />{help ? <span className="text-xs text-kino-muted" id={descriptionId}>{help}</span> : null}</label>
}
