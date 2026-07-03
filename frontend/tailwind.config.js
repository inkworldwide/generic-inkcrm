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
        sans: ['var(--font-family, Inter)', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        premium: '0 4px 20px -2px rgba(17, 24, 39, 0.05), 0 2px 6px -1px rgba(17, 24, 39, 0.03)',
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.07)'
      }
    },
  },
  plugins: [],
}
