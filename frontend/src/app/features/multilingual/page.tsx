import type { Metadata } from 'next';
import MultilingualContent from './MultilingualContent';
import MultilingualJsonLd from './MultilingualJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'AI Document Chat in 11 Languages',
  description:
    'Chat with documents in English, Chinese, Japanese, Spanish, German, French, Korean, Portuguese, Italian, Arabic, and Hindi. AI understands your language.',
  path: '/features/multilingual',
  localized: true,
  keywords: ['multilingual document ai', 'ai chat any language', 'document translation ai'],
  openGraph: {
    title: 'AI Document Chat in 11 Languages | DocTalk',
    description:
      'Chat with documents in English, Chinese, Japanese, Spanish, German, French, Korean, Portuguese, Italian, Arabic, and Hindi.',
  },
});

export default function MultilingualPage() {
  return (
    <>
      <MultilingualJsonLd locale="en" />
      <MultilingualContent locale="en" />
    </>
  );
}
