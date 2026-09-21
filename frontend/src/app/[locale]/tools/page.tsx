import ToolsHubJsonLd from '../../tools/ToolsHubJsonLd';
import ToolsHubContent from '../../tools/ToolsHubContent';
import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: ToolsHubJsonLd,
  Content: ToolsHubContent,
  path: '/tools',
  metaTitleKey: 'toolsHub.metaTitle',
  metaDescKey: 'toolsHub.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
