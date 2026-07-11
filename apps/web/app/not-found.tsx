'use client'

import { HttpErrorState } from '@/components/error-state'

export default function NotFound() {
  return <HttpErrorState status={404} />
}
