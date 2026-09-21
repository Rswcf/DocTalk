import MultiFormatJsonLd from '../../../features/multi-format/MultiFormatJsonLd';
import MultiFormatContent from '../../../features/multi-format/MultiFormatContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: MultiFormatJsonLd,
  Content: MultiFormatContent,
  path: '/features/multi-format',
  metaTitleKey: 'featuresMultiFormat.metaTitle',
  metaDescKey: 'featuresMultiFormat.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
