import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
        xl: '2.5rem',
      },
      screens: { '2xl': '1440px' },
    },
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        elevated: 'rgb(var(--elevated) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        faint: 'rgb(var(--faint) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          soft: 'rgb(var(--primary-soft) / <alpha-value>)',
          strong: 'rgb(var(--primary-strong) / <alpha-value>)',
          ink: 'rgb(var(--primary-ink) / <alpha-value>)',
        },
        success: 'rgb(var(--success) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)',
        // Legacy admin aliases.
        canvas: 'rgb(var(--bg) / <alpha-value>)',
        paper: 'rgb(var(--surface) / <alpha-value>)',
        pine: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          deep: 'rgb(var(--primary-strong) / <alpha-value>)',
          soft: 'rgb(var(--primary-soft) / <alpha-value>)',
          ink: 'rgb(var(--primary-ink) / <alpha-value>)',
        },
        sand: 'rgb(var(--elevated) / <alpha-value>)',
        warn: 'rgb(var(--warning) / <alpha-value>)',
        'warn-soft': 'rgb(var(--warning) / 0.12)',
        'success-soft': 'rgb(var(--success) / 0.12)',
        'danger-soft': 'rgb(var(--danger) / 0.12)',
        // Lime stays a static brand accent (bright green) in both themes.
        lime: {
          DEFAULT: '#C9F27B',
          strong: '#B4E85A',
          soft: '#F1FBDD',
        },
      },
      fontFamily: {
        sans: ['"Manrope Variable"', 'Manrope', 'system-ui', 'sans-serif'],
        display: ['"Manrope Variable"', 'Manrope', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 40, 31, 0.04), 0 14px 38px -24px rgba(16, 40, 31, 0.22)',
        lift: '0 2px 3px rgba(16, 40, 31, 0.05), 0 26px 52px -28px rgba(16, 40, 31, 0.3)',
        sidebar: '18px 0 60px -50px rgba(6, 26, 20, 0.55)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.2s ease-out both',
        shimmer: 'shimmer 1.6s infinite',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}

export default config