import type { Metadata } from 'next'
import { IBM_Plex_Sans, Sora, Fraunces, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import './editorial.css'
import ErrorBoundary from '../components/ErrorBoundary'
import { ThemeProvider } from './ThemeProvider'
import LocaleProvider from '../i18n/LocaleProvider'
import { Providers } from '../components/Providers'
import { Suspense } from 'react'
import { AuthModal } from '../components/AuthModal'
import { AnalyticsWrapper } from '../components/AnalyticsWrapper'
import { CookieConsentBanner } from '../components/CookieConsentBanner'

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
})
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-logo',
  weight: ['500', '600', '700'],
  display: 'swap',
})

// Not preloaded. Since the Night marketing surface (v0.32.0) no page shows
// Fraunces when it loads: Night display type is Geist, and the app's citation
// popover (italic) is its only reader, which fetches the face on first open.
// Preloading put 270 KB on every route's critical path; on a throttled phone
// that cost ~0.2 s of LCP (scripts/design-audit/cwvcheck.mjs, 2026-09-21).
const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz', 'SOFT'],
  variable: '--font-fraunces',
  display: 'swap',
  preload: false,
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.doctalk.site'),
  title: {
    default: 'DocTalk — AI Document Chat with Cited Answers',
    template: '%s | DocTalk',
  },
  description: 'Upload any document and chat with AI. Get instant answers with source citations that highlight in your document. Supports PDF, DOCX, PPTX, XLSX, and more.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'DocTalk — AI Document Chat',
    description: 'Chat with your documents. AI answers with page-level citations.',
    type: 'website',
    url: 'https://www.doctalk.site',
    siteName: 'DocTalk',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DocTalk — AI Document Chat',
    description: 'Chat with your documents. AI answers with page-level citations.',
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml', sizes: 'any' }],
    apple: [{ url: '/logo-icon.png', type: 'image/png', sizes: '512x512' }],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // <html lang> starts at "en" at SSR time so every page can prerender
  // statically and hit Vercel's CDN. LocaleProvider mutates
  // document.documentElement.lang on mount via client-side detection
  // (localStorage + navigator.language). The earlier `await cookies()`
  // here — together with the removed middleware.ts locale cookie —
  // was the direct cause of `Cache-Control: private, no-store` on every
  // SEO page and is the single biggest unlock for organic traffic.
  return (
    <html lang="en" suppressHydrationWarning className={`${plexSans.variable} ${sora.variable} ${fraunces.variable} ${plexMono.variable}`}>
      <head>
        <meta name="google-site-verification" content="168G1TYJfQ7MNp4sNdF-7gC2wDWKGeds618LyLdkCUM" />
        <meta name="msvalidate.01" content="50E7D296303C85BC31C1BE98539EA393" />
        {/* Paper stage / warm near-black — the §5.3 tokens, so mobile browser
            chrome matches the page instead of framing it in white or zinc.
            These are root-level and therefore apply to the app surface too;
            under decision A2 the app moves onto the same ground in Phase 3,
            at which point they are already right. */}
        <meta name="theme-color" content="#eae8e3" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#171614" media="(prefers-color-scheme: dark)" />
      </head>
      <body className="font-sans antialiased">
        {/* i18n: skip link is server-rendered, locale-specific version requires server-side i18n */}
        <a
          href="#page-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-zinc-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white dark:focus:bg-zinc-100 dark:focus:text-zinc-900"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <Providers>
            <LocaleProvider>
              <ErrorBoundary>
                <div id="page-content" className="dt-stitch-root">{children}</div>
                <Suspense fallback={null}>
                  <AuthModal />
                </Suspense>
                <CookieConsentBanner />
              </ErrorBoundary>
            </LocaleProvider>
          </Providers>
        </ThemeProvider>
        <AnalyticsWrapper />
      </body>
    </html>
  )
}
