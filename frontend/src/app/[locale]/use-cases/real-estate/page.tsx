import RealEstateContent from '../../../use-cases/real-estate/RealEstateContent';
import RealEstateJsonLd from '../../../use-cases/real-estate/RealEstateJsonLd';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: RealEstateContent,
  JsonLd: RealEstateJsonLd,
  path: '/use-cases/real-estate',
  metaTitleKey: 'useCasesRealEstate.metaTitle',
  metaDescKey: 'useCasesRealEstate.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
