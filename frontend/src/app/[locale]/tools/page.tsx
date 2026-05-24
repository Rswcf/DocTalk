import ToolsHubContent from '../../tools/ToolsHubContent';
import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: ToolsHubContent,
  path: '/tools',
  titleKey: 'toolsHub.heroTitle',
  descKey: 'toolsHub.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
