import type { Transition, Variants } from 'framer-motion'

export const motionEase = [0.16, 1, 0.3, 1] as const

export const motionTransition: Transition = {
  duration: 0.92,
  ease: motionEase,
}

export const premiumSpring: Transition = {
  type: 'spring',
  stiffness: 72,
  damping: 18,
  mass: 0.9,
}

export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 32, scale: 0.99 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: motionTransition,
  },
}

export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { delayChildren: 0.08, staggerChildren: 0.1 },
  },
}

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: motionTransition },
}

export const interactiveVariants: Variants = {
  rest: { y: 0, scale: 1 },
  hover: { y: -3, scale: 1.01 },
  tap: { y: 0, scale: 0.985 },
}

export const heroSequenceVariants: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.12, staggerChildren: 0.11 } },
}

export const heroContentVariants: Variants = {
  hidden: { opacity: 0, y: '-100vh' },
  visible: { opacity: 1, y: 0, transition: { ...premiumSpring, stiffness: 68 } },
}

export const heroFeatureCardsVariants: Variants = {
  hidden: { opacity: 0, y: '100vh' },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      ...premiumSpring,
      delay: 0.18,
      stiffness: 68,
      when: 'beforeChildren',
      staggerChildren: 0.08,
    },
  },
}

export const heroFeatureCardVariants: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { ...premiumSpring, stiffness: 82, damping: 20 },
  },
  hover: { y: -3, scale: 1.01 },
}

export const heroPreviewVariants: Variants = {
  hidden: { opacity: 0, x: '100vw' },
  visible: {
    opacity: 1,
    x: 0,
    transition: { ...premiumSpring, delay: 0.26, stiffness: 62, damping: 19 },
  },
}

export const previewActionsVariants: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.72, staggerChildren: 0.1 } },
}

export const previewActionVariants: Variants = {
  hidden: { opacity: 0, y: '100vh' },
  visible: { opacity: 1, y: 0, transition: { ...premiumSpring, stiffness: 76 } },
}

export const showcaseLeftVariants: Variants = {
  hidden: { opacity: 0, x: '-18vw' },
  visible: { opacity: 1, x: 0, transition: { ...premiumSpring, stiffness: 64 } },
}

export const showcaseRightVariants: Variants = {
  hidden: { opacity: 0, x: '18vw' },
  visible: {
    opacity: 1,
    x: 0,
    transition: { ...premiumSpring, delay: 0.1, stiffness: 78, damping: 20 },
  },
}
