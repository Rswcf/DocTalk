import LayoutTranslationContent from '../../../features/layout-translation/LayoutTranslationContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: LayoutTranslationContent,
  path: '/features/layout-translation',
  titleKey: 'featuresLayoutTranslation.heroTitle',
  descKey: 'featuresLayoutTranslation.heroSubtitle',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
