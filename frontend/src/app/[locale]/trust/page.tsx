import TrustJsonLd from '../../trust/TrustJsonLd';
import TrustPageContent from '../../trust/TrustPageContent';
import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: TrustJsonLd,
  Content: TrustPageContent,
  path: '/trust',
  metaTitleKey: 'trust.metaTitle',
  metaDescKey: 'trust.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
