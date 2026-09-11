import type { Metadata } from 'next';
import AskyourpdfContent from './AskyourpdfContent';
import AskyourpdfJsonLd from './AskyourpdfJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'DocTalk vs AskYourPDF Comparison',
  description:
    'Compare DocTalk and AskYourPDF for AI document analysis, citation quality, format support, integrations, pricing, and everyday usability.',
  path: '/compare/askyourpdf',
  localized: true,
  keywords: ['doctalk vs askyourpdf', 'askyourpdf alternative', 'askyourpdf comparison'],
  openGraph: {
    title: 'DocTalk vs AskYourPDF Comparison | DocTalk',
    description:
      'Feature comparison of DocTalk vs AskYourPDF. Citation highlighting, format support, integrations, and pricing.',
  },
});


export default function CompareAskyourpdfPage() {
  return (
    <>
      <AskyourpdfJsonLd locale="en" />
      <AskyourpdfContent locale="en" />
    </>
  );
}
