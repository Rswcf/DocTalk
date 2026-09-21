import HumataJsonLd from '../../../compare/humata/HumataJsonLd';
import HumataContent from '../../../compare/humata/HumataContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: HumataJsonLd,
  Content: HumataContent,
  path: '/compare/humata',
  metaTitleKey: 'compareHumata.metaTitle',
  metaDescKey: 'compareHumata.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
