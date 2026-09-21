import PdfaiJsonLd from '../../../compare/pdf-ai/PdfaiJsonLd';
import PdfaiContent from '../../../compare/pdf-ai/PdfaiContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: PdfaiJsonLd,
  Content: PdfaiContent,
  path: '/compare/pdf-ai',
  metaTitleKey: 'comparePdfai.metaTitle',
  metaDescKey: 'comparePdfai.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
