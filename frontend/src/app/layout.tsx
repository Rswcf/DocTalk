import type { Metadata } from 'next'
import { Inter, Instrument_Serif, Sora } from 'next/font/google'
import './globals.css'
import ErrorBoundary from '../components/ErrorBoundary'
import { ThemeProvider } from './ThemeProvider'
import LocaleProvider from '../i18n/LocaleProvider'
import { Providers } from '../components/Providers'
import { Suspense } from 'react'
import { AuthModal } from '../components/AuthModal'
import { AnalyticsWrapper } from '../components/AnalyticsWrapper'
import { CookieConsentBanner } from '../components/CookieConsentBanner'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const instrumentSerif = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-logo',
  weight: ['600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'DocTalk',
  description: 'DocTalk — PDF chat assistant',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${instrumentSerif.variable} ${sora.variable}`}>
      <head>
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <Providers>
            <LocaleProvider>
              <ErrorBoundary>
                {children}
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
