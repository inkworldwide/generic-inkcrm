/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enables class-based toggling
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#F0F3F9',
          100: '#D9E2EC',
          200: '#B0C2DE',
          600: '#24324A',
          800: '#17223B',
          900: '#0F172A',
        },
        gold: {
          50: '#FDF8F0',
          100: '#F9EED9',
          500: '#D59B45',
          600: '#C18732',
        },
        cream: {
          50: '#FDFBF7',
          100: '#F8F5F1',
          200: '#EAE4DA',
        },
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        sidebar: {
          bg: 'var(--sidebar-bg)',
          text: 'var(--sidebar-text, #ffffff)',
          hover: 'var(--sidebar-hover, rgba(255,255,255,0.08))'
        },
        header: {
          bg: 'var(--header-bg)',
          text: 'var(--header-text, #1e293b)'
        }
      },
      fontFamily: {
        sans: ['Geist', 'var(--font-family, Inter)', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        premium: '0 4px 20px -2px rgba(23, 34, 59, 0.04), 0 2px 6px -1px rgba(23, 34, 59, 0.02)',
        'premium-hover': '0 12px 28px -4px rgba(23, 34, 59, 0.07), 0 4px 12px -2px rgba(23, 34, 59, 0.04)',
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.07)'
      }
    },
  },
  plugins: [],
}
