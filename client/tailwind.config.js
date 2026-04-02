/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        appbg: '#f0f2f5',
        ink: '#111827',
        muted: '#6b7280',
        brand: '#2563eb',
        success: '#16a34a',
        danger: '#dc2626',
        word: '#2563eb'
      },
      boxShadow: {
        card: '0 24px 60px rgba(15, 23, 42, 0.08)'
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' }
        }
      },
      animation: {
        rise: 'rise 0.45s ease-out',
        'pulse-soft': 'pulseSoft 1.4s ease-in-out infinite'
      }
    }
  },
  plugins: []
}
