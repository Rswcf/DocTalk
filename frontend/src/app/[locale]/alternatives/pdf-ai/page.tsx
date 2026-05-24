import PdfAiAltsContent from '../../../alternatives/pdf-ai/PdfAiAltsContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: PdfAiAltsContent,
  path: '/alternatives/pdf-ai',
  titleKey: 'altsPdfai.heroTitle',
  descKey: 'altsPdfai.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
