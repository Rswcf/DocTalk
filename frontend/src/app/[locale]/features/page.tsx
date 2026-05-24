import FeaturesHubContent from '../../features/FeaturesHubContent';
import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: FeaturesHubContent,
  path: '/features',
  titleKey: 'featuresHub.heroTitle',
  descKey: 'featuresHub.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
