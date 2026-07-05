/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,tsx}',
    './components/**/*.{js,ts,tsx}',
    '../../packages/ui/src/**/*.{js,ts,tsx}',
  ],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#121212', // Dimmed dark background
        surface: '#1E1E1E', // Cards and containers
        accent: '#1DB954', // Vibrant Tel
        'text-primary': '#E0E0E0', // Light gray for primary text
        'text-secondary': '#B0B0B0', // Dimmer gray for secondary text
        'rating-from': '#FFC107',
        'rating-to': '#FF9800',
      },
    },
  },
  plugins: [],
}
