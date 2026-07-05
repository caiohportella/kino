/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,tsx}',
    './components/**/*.{js,ts,tsx}',
    './lib/**/*.{js,ts,tsx}',
    './stores/**/*.{js,ts,tsx}',
    '../../packages/ui/src/**/*.{js,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        kino: {
          bg: 'rgb(var(--kino-bg-rgb) / <alpha-value>)',
          panel: 'rgb(var(--kino-panel-rgb) / <alpha-value>)',
          surface: 'rgb(var(--kino-surface-rgb) / <alpha-value>)',
          elevated: 'rgb(var(--kino-elevated-rgb) / <alpha-value>)',
          text: 'rgb(var(--kino-text-rgb) / <alpha-value>)',
          muted: 'rgb(var(--kino-muted-rgb) / <alpha-value>)',
          subtle: 'rgb(var(--kino-subtle-rgb) / <alpha-value>)',
          accent: 'rgb(var(--kino-accent-rgb) / <alpha-value>)',
          'accent-strong': 'rgb(var(--kino-accent-strong-rgb) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
