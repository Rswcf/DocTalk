import LayoutTranslationContent from '../../../features/layout-translation/LayoutTranslationContent';
import LayoutTranslationJsonLd from '../../../features/layout-translation/LayoutTranslationJsonLd';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: LayoutTranslationContent,
  JsonLd: LayoutTranslationJsonLd,
  path: '/features/layout-translation',
  metaTitleKey: 'featuresLayoutTranslation.metaTitle',
  metaDescKey: 'featuresLayoutTranslation.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
