import type { Metadata } from 'next'
import './globals.css'
import ErrorBoundary from '../components/ErrorBoundary'
import { ThemeProvider } from './ThemeProvider'
import LocaleProvider from '../i18n/LocaleProvider'
import { Providers } from '../components/Providers'
import { Suspense } from 'react'
import { AuthModal } from '../components/AuthModal'

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
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Providers>
            <LocaleProvider>
              <ErrorBoundary>
                {children}
                <Suspense fallback={null}>
                  <AuthModal />
                </Suspense>
              </ErrorBoundary>
            </LocaleProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
