/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{html,ts}',
    './node_modules/primeng/**/*.{mjs,js}',
    './node_modules/primeflex/**/*.css',
    './node_modules/primeicons/**/*.css'
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          0: 'var(--surface-0)',
          100: 'var(--surface-100)',
          200: 'var(--surface-200)',
          300: 'var(--surface-300)',
          500: 'var(--surface-500)',
          700: 'var(--surface-700)',
          800: 'var(--surface-800)',
          900: 'var(--surface-900)'
        }
      }
    }
  },
  plugins: []
};
