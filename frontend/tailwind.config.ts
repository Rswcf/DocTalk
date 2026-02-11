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
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'Times New Roman', 'serif'],
        logo: ['var(--font-logo)', 'system-ui', 'sans-serif'],
        win98: ["'MS Sans Serif'", "'Microsoft Sans Serif'", "'Segoe UI'", 'Tahoma', 'sans-serif'],
      },
      colors: {
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          light: 'var(--accent-light)',
          foreground: 'var(--accent-foreground)',
        },
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'reveal-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
        'reveal-up': 'reveal-up 600ms ease-out both',
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': '#09090b',
            '--tw-prose-headings': '#09090b',
            '--tw-prose-bold': '#09090b',
            'code::before': { content: 'none' },
            'code::after': { content: 'none' },
            code: {
              backgroundColor: 'rgb(0 0 0 / 0.06)',
              borderRadius: '0.375rem',
              padding: '0.125rem 0.375rem',
              fontWeight: '500',
              fontSize: '0.875em',
            },
          },
        },
        invert: {
          css: {
            '--tw-prose-invert-body': '#fafafa',
            '--tw-prose-invert-headings': '#fafafa',
            '--tw-prose-invert-bold': '#fafafa',
            code: {
              backgroundColor: 'rgb(255 255 255 / 0.12)',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
export default config
