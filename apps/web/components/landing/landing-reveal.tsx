'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { type ReactNode } from 'react'
import { revealVariants } from '@/components/landing/motion'
import { cn } from '@/lib/utils'

export function LandingReveal({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={cn(className)}
      initial={reduceMotion ? false : 'hidden'}
      variants={revealVariants}
      viewport={{ once: true, amount: 0.18, margin: '0px 0px -10% 0px' }}
      whileInView="visible"
    >
      {children}
    </motion.div>
  )
}
