import PdfaiJsonLd from '../../../compare/pdf-ai/PdfaiJsonLd';
import PdfaiContent from '../../../compare/pdf-ai/PdfaiContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: PdfaiJsonLd,
  Content: PdfaiContent,
  path: '/compare/pdf-ai',
  titleKey: 'comparePdfai.heroTitle',
  descKey: 'comparePdfai.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
