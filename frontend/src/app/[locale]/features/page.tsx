import FeaturesHubJsonLd from '../../features/FeaturesHubJsonLd';
import FeaturesHubContent from '../../features/FeaturesHubContent';
import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: FeaturesHubJsonLd,
  Content: FeaturesHubContent,
  path: '/features',
  titleKey: 'featuresHub.heroTitle',
  descKey: 'featuresHub.heroSubtitle',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
