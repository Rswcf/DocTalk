import CitationsContent from '../../../features/citations/CitationsContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: CitationsContent,
  path: '/features/citations',
  titleKey: 'featuresCitations.heroTitle',
  descKey: 'featuresCitations.heroSubtitle',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
