/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070d18',
          900: '#0c1626',
          850: '#111e33',
          800: '#162740',
          700: '#23395d',
          600: '#34507d',
        },
        teal: {
          500: '#0d9488',
          600: '#0f766e',
          700: '#115e59',
        },
        alert: {
          red: '#dc2626',
          amber: '#f59e0b',
          green: '#10b981',
          blue: '#2563eb'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
