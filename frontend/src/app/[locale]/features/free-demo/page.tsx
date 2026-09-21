import FreeDemoJsonLd from '../../../features/free-demo/FreeDemoJsonLd';
import FreeDemoContent from '../../../features/free-demo/FreeDemoContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: FreeDemoJsonLd,
  Content: FreeDemoContent,
  path: '/features/free-demo',
  metaTitleKey: 'featuresDemo.metaTitle',
  metaDescKey: 'featuresDemo.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
