import RealEstateContent from '../../../use-cases/real-estate/RealEstateContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: RealEstateContent,
  path: '/use-cases/real-estate',
  titleKey: 'useCasesRealEstate.heroTitle',
  descKey: 'useCasesRealEstate.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
