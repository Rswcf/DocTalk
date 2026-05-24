import HumataContent from '../../../compare/humata/HumataContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: HumataContent,
  path: '/compare/humata',
  titleKey: 'compareHumata.heroTitle',
  descKey: 'compareHumata.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
