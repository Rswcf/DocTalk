import PricingJsonLd from '../../pricing/PricingJsonLd';
import PricingPageContent from '../../pricing/PricingPageContent';
import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: PricingJsonLd,
  Content: PricingPageContent,
  path: '/pricing',
  metaTitleKey: 'pricing.metaTitle',
  metaDescKey: 'pricing.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
