import CompareHubJsonLd from '../../compare/CompareHubJsonLd';
import CompareHubContent from '../../compare/CompareHubContent';
import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: CompareHubJsonLd,
  Content: CompareHubContent,
  path: '/compare',
  metaTitleKey: 'compareHub.metaTitle',
  metaDescKey: 'compareHub.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
