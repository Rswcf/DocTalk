import FreeDemoContent from '../../../features/free-demo/FreeDemoContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: FreeDemoContent,
  path: '/features/free-demo',
  titleKey: 'featuresDemo.hero.title',
  descKey: 'featuresDemo.hero.subtitle',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
