import MultilingualJsonLd from '../../../features/multilingual/MultilingualJsonLd';
import MultilingualContent from '../../../features/multilingual/MultilingualContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: MultilingualJsonLd,
  Content: MultilingualContent,
  path: '/features/multilingual',
  metaTitleKey: 'featuresMultilingual.metaTitle',
  metaDescKey: 'featuresMultilingual.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
