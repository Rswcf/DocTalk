import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DocTalk',
    short_name: 'DocTalk',
    description: 'AI document chat with cited answers for PDFs, Office files, text, Markdown, and URLs.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fafaf7',
    theme_color: '#18181b',
    icons: [
      {
        src: '/logo-icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}
