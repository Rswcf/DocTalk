import ToolsHubJsonLd from '../../tools/ToolsHubJsonLd';
import ToolsHubContent from '../../tools/ToolsHubContent';
import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: ToolsHubJsonLd,
  Content: ToolsHubContent,
  path: '/tools',
  titleKey: 'toolsHub.heroTitle',
  descKey: 'toolsHub.heroLede',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
