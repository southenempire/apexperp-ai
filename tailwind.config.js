/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        somnia: {
          50: '#f0f9ff',
          400: '#38bdf8',
          500: '#0ea5e9',
          900: '#0c4a6e',
        },
        dark: {
          950: '#07090e',
          900: '#0c1017',
          850: '#111722',
          800: '#17202f',
          700: '#233044',
          600: '#32445e',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}
