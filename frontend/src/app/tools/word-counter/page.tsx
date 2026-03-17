import type { Metadata } from 'next';
import WordCounterClient from './WordCounterClient';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Free Document Word Counter - Count Words in PDF, DOCX, TXT',
  description:
    'Count words, characters, sentences, and paragraphs instantly. See reading time estimates and most frequent words. Free online word counter tool.',
  path: '/tools/word-counter',
  keywords: [
    'word counter',
    'pdf word counter',
    'document word counter online free',
    'character counter',
    'sentence counter',
    'word frequency counter',
    'online word count tool',
  ],
  openGraph: {
    title: 'Free Word Counter Tool | DocTalk',
  },
});

export default function WordCounterPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.doctalk.site' },
              { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://www.doctalk.site/tools' },
              { '@type': 'ListItem', position: 3, name: 'Word Counter' },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'DocTalk Word Counter',
            applicationCategory: 'UtilityApplication',
            operatingSystem: 'Web',
            url: 'https://www.doctalk.site/tools/word-counter',
            description:
              'Free online word counter tool. Count words, characters, sentences, and paragraphs. See reading time and word frequency.',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          }),
        }}
      />
      <WordCounterClient />
    </>
  );
}
