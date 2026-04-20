import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:  '#0F1117',
          surface:  '#1A1D27',
          elevated: '#1E2130',
          border:   '#2D3148',
        },
        accent: {
          DEFAULT: '#6C63FF',
          hover:   '#5B52E8',
          muted:   'rgba(108,99,255,0.15)',
        },
        status: {
          success: '#22C55E',
          failure: '#EF4444',
          pending: '#F59E0B',
          info:    '#38BDF8',
        },
        txt: {
          primary:   '#F1F5F9',
          secondary: '#94A3B8',
          muted:     '#64748B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'slide-in':  'slideIn 0.2s ease-out',
        'fade-in':   'fadeIn 0.15s ease-out',
        'pulse-dot': 'pulseDot 2s infinite',
      },
      keyframes: {
        slideIn: {
          '0%':   { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)',    opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
      },
    },
  },
  plugins: [],
}

export default config
