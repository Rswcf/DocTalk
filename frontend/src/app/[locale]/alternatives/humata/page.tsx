import HumataAltsContent from '../../../alternatives/humata/HumataAltsContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: HumataAltsContent,
  path: '/alternatives/humata',
  titleKey: 'altsHumata.heroTitle',
  descKey: 'altsHumata.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
