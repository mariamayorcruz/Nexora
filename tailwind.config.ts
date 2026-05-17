/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: '#22D3EE',
          foreground: '#0B1020',
        },
        secondary: {
          DEFAULT: '#3B82F6',
          foreground: '#ffffff',
        },
        accent: {
          DEFAULT: '#8B5CF6',
          foreground: '#ffffff',
        },
        muted: {
          DEFAULT: '#111827',
          foreground: '#94a3b8',
        },
        card: {
          DEFAULT: '#111827',
          foreground: '#f1f5f9',
        },
        nexora: {
          cyan: '#22D3EE',
          blue: '#3B82F6',
          violet: '#8B5CF6',
          dark: '#0B1020',
          navy: '#111827',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
        },
      },
      boxShadow: {
        soft: '0 12px 32px rgba(15, 23, 42, 0.08)',
        glow: '0 0 24px rgba(34, 211, 238, 0.12)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
