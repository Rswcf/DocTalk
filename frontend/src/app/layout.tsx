import type { Metadata } from 'next'
import { Inter, Sora } from 'next/font/google'
import './globals.css'
import ErrorBoundary from '../components/ErrorBoundary'
import { ThemeProvider } from './ThemeProvider'
import LocaleProvider from '../i18n/LocaleProvider'
import { Providers } from '../components/Providers'
import { Suspense } from 'react'
import { AuthModal } from '../components/AuthModal'
import { AnalyticsWrapper } from '../components/AnalyticsWrapper'
import { CookieConsentBanner } from '../components/CookieConsentBanner'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-logo',
  weight: ['500', '600', '700'],
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
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${sora.variable}`}>
      <head>
        <meta name="google-site-verification" content="168G1TYJfQ7MNp4sNdF-7gC2wDWKGeds618LyLdkCUM" />
        <meta name="msvalidate.01" content="50E7D296303C85BC31C1BE98539EA393" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
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
                <div id="page-content">{children}</div>
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
