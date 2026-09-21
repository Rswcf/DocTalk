import HumataAltsJsonLd from '../../../alternatives/humata/HumataAltsJsonLd';
import HumataAltsContent from '../../../alternatives/humata/HumataAltsContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: HumataAltsJsonLd,
  Content: HumataAltsContent,
  path: '/alternatives/humata',
  metaTitleKey: 'altsHumata.metaTitle',
  metaDescKey: 'altsHumata.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
