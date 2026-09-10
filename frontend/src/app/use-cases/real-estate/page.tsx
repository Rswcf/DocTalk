import type { Metadata } from 'next';
import RealEstateContent from './RealEstateContent';
import RealEstateJsonLd from './RealEstateJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'AI Document Analysis for Real Estate Professionals',
  description:
    'Review leases, purchase agreements, inspection reports, and property appraisals with AI. Get cited answers from complex real estate documents.',
  path: '/use-cases/real-estate',
  localized: true,
  keywords: ['ai for real estate', 'real estate document analysis', 'ai lease review', 'property document ai'],
  openGraph: {
    title: 'AI Document Analysis for Real Estate Professionals | DocTalk',
    description:
      'Review leases, purchase agreements, and inspection reports with AI-powered cited answers. Streamline real estate document review. Try free.',
  },
});

export default function RealEstatePage() {
  return (
    <>
      <RealEstateJsonLd locale="en" />
      <RealEstateContent locale="en" />
    </>
  );
}
