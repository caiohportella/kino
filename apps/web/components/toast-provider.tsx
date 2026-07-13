'use client'

import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type ToastTone = 'success' | 'error'

interface ToastMessage {
  id: number
  tone: ToastTone
  title: string
  body?: string
}

interface ToastContextValue {
  notify: (message: Omit<ToastMessage, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([])
  const { t } = useTranslation()

  const dismiss = useCallback((id: number) => {
    setMessages((current) => current.filter((message) => message.id !== id))
  }, [])

  const notify = useCallback(
    (message: Omit<ToastMessage, 'id'>) => {
      const id = Date.now() + Math.floor(Math.random() * 1000)
      setMessages((current) => [...current.slice(-3), { ...message, id }])
      window.setTimeout(() => dismiss(id), 3200)
    },
    [dismiss]
  )

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions text"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(calc(100vw-32px),360px)] flex-col gap-3"
      >
        {messages.map((message) => {
          const Icon = message.tone === 'success' ? CheckCircle2 : AlertTriangle
          return (
            <div
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-md border bg-kino-panel p-4 shadow-soft kino-toast-in',
                message.tone === 'success' ? 'border-kino-accent/40' : 'border-red-500/40'
              )}
              key={message.id}
              role={message.tone === 'error' ? 'alert' : 'status'}
            >
              <Icon
                aria-hidden="true"
                className={
                  message.tone === 'success' ? 'mt-0.5 text-kino-accent' : 'mt-0.5 text-red-300'
                }
                size={18}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-kino-text">{message.title}</div>
                {message.body ? (
                  <div className="mt-1 text-xs leading-5 text-kino-muted">{message.body}</div>
                ) : null}
              </div>
              <Button
                aria-label={t('common.close')}
                className="-mr-2 -mt-2 text-kino-muted hover:text-kino-text"
                onClick={() => dismiss(message.id)}
                size="icon"
                variant="ghost"
              >
                <X aria-hidden="true" size={15} />
              </Button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
