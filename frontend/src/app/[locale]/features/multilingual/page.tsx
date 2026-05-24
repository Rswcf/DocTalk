import MultilingualContent from '../../../features/multilingual/MultilingualContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: MultilingualContent,
  path: '/features/multilingual',
  titleKey: 'featuresMultilingual.hero.title',
  descKey: 'featuresMultilingual.hero.subtitle',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
