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
        // --dt-body = IBM Plex Sans for Latin, + curated system CJK/Arabic/Devanagari
        // stacks under :lang() (see globals.css). Latin output is unchanged.
        sans: ['var(--dt-body)'],
        display: ['var(--font-logo)', 'var(--font-plex-sans)', 'system-ui', 'sans-serif'],
        logo: ['var(--font-logo)', 'var(--font-plex-sans)', 'system-ui', 'sans-serif'],
        // Legacy alias: older pages still use `font-serif`, but the
        // Stitch direction is rounded sans display type, not editorial serif.
        serif: ['var(--font-logo)', 'var(--font-plex-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          light: 'var(--accent-light)',
          foreground: 'var(--accent-foreground)',
        },
        surface: {
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
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
            // The app font is IBM Plex Sans loaded at weights 400-700 only
            // (layout.tsx) — 700 is its true ceiling. The typography
            // plugin's own defaults request h1:800, 'h1 strong':900, and
            // 'h2 strong':800 (checked every fontWeight declaration in
            // @tailwindcss/typography/src/styles.js; nothing else in the
            // DEFAULT size variant exceeds 700), which the browser
            // synthesizes/flattens against the closest loaded face since no
            // 800/900 weight was ever fetched. Cap those three at 700 so
            // prose headings render the real font instead of a
            // browser-synthesized (or silently flattened) bold.
            h1: { fontWeight: '700' },
            'h1 strong': { fontWeight: '700' },
            'h2 strong': { fontWeight: '700' },
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
