import AlternativesHubContent from '../../alternatives/AlternativesHubContent';
import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: AlternativesHubContent,
  path: '/alternatives',
  titleKey: 'altsHub.title',
  descKey: 'altsHub.subtitle',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
