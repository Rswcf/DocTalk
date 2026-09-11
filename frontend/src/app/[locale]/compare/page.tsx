import CompareHubJsonLd from '../../compare/CompareHubJsonLd';
import CompareHubContent from '../../compare/CompareHubContent';
import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: CompareHubJsonLd,
  Content: CompareHubContent,
  path: '/compare',
  titleKey: 'compareHub.heroTitle',
  descKey: 'compareHub.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
