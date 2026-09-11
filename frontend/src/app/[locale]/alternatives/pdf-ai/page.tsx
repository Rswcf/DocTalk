import PdfAiAltsJsonLd from '../../../alternatives/pdf-ai/PdfAiAltsJsonLd';
import PdfAiAltsContent from '../../../alternatives/pdf-ai/PdfAiAltsContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: PdfAiAltsJsonLd,
  Content: PdfAiAltsContent,
  path: '/alternatives/pdf-ai',
  titleKey: 'altsPdfai.heroTitle',
  descKey: 'altsPdfai.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
