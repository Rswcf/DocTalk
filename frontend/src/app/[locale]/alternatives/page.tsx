import AlternativesHubJsonLd from '../../alternatives/AlternativesHubJsonLd';
import AlternativesHubContent from '../../alternatives/AlternativesHubContent';
import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: AlternativesHubJsonLd,
  Content: AlternativesHubContent,
  path: '/alternatives',
  metaTitleKey: 'altsHub.metaTitle',
  metaDescKey: 'altsHub.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
