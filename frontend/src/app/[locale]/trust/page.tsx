import TrustPageContent from '../../trust/TrustPageContent';
import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: TrustPageContent,
  path: '/trust',
  titleKey: 'trust.hero.title',
  descKey: 'trust.hero.lede',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
