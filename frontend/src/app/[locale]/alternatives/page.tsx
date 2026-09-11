import AlternativesHubJsonLd from '../../alternatives/AlternativesHubJsonLd';
import AlternativesHubContent from '../../alternatives/AlternativesHubContent';
import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: AlternativesHubJsonLd,
  Content: AlternativesHubContent,
  path: '/alternatives',
  titleKey: 'altsHub.title',
  descKey: 'altsHub.subtitle',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
