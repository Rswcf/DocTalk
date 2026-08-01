import DemoPageClient from '../../demo/DemoPageClient';
import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: DemoPageClient,
  path: '/demo',
  titleKey: 'demo.title',
  descKey: 'demo.subtitle',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
