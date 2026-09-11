import type { Metadata } from 'next';
import HumataContent from './HumataContent';
import HumataJsonLd from './HumataJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'DocTalk vs Humata: AI Document Tool Comparison',
  description:
    'Compare DocTalk and Humata for AI document analysis, including citation quality, team features, language support, pricing, and video support.',
  path: '/compare/humata',
  localized: true,
  keywords: ['doctalk vs humata', 'humata alternative', 'humata ai comparison'],
  openGraph: {
    title: 'DocTalk vs Humata: AI Document Tool Comparison | DocTalk',
    description:
      'DocTalk vs Humata: citation highlighting, language support, team features, and pricing compared side by side.',
  },
});


export default function CompareHumataPage() {
  return (
    <>
      <HumataJsonLd locale="en" />
      <HumataContent locale="en" />
    </>
  );
}
