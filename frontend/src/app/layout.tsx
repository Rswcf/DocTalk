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

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-logo',
  weight: ['500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.doctalk.site'),
  title: 'DocTalk — AI Document Chat with Cited Answers',
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
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${sora.variable}`}>
      <head>
        <meta name="msvalidate.01" content="50E7D296303C85BC31C1BE98539EA393" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'WebSite',
                  name: 'DocTalk',
                  alternateName: 'DocTalk AI',
                  url: 'https://www.doctalk.site',
                  description: 'AI document chat with cited answers',
                },
                {
                  '@type': 'Organization',
                  name: 'DocTalk',
                  url: 'https://www.doctalk.site',
                  logo: {
                    '@type': 'ImageObject',
                    url: 'https://www.doctalk.site/logo-icon.svg',
                    width: 512,
                    height: 512,
                  },
                  description:
                    'AI-powered document chat app. Upload PDF, DOCX, PPTX, XLSX and get instant answers with source citations that highlight in your document.',
                  foundingDate: '2025',
                  sameAs: ['https://github.com/Rswcf/DocTalk'],
                  contactPoint: {
                    '@type': 'ContactPoint',
                    email: 'support@doctalk.app',
                    contactType: 'customer support',
                  },
                },
              ],
            }),
          }}
        />
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
