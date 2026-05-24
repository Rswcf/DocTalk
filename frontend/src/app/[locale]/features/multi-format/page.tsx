import MultiFormatContent from '../../../features/multi-format/MultiFormatContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: MultiFormatContent,
  path: '/features/multi-format',
  titleKey: 'featuresMultiFormat.heroTitle',
  descKey: 'featuresMultiFormat.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
