import PricingJsonLd from '../../pricing/PricingJsonLd';
import PricingPageContent from '../../pricing/PricingPageContent';
import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: PricingJsonLd,
  Content: PricingPageContent,
  path: '/pricing',
  titleKey: 'pricing.headline',
  descKey: 'pricing.description',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
