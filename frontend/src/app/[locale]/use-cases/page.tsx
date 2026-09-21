import UseCasesHubContent from '../../use-cases/UseCasesHubContent';
import UseCasesHubJsonLd from '../../use-cases/UseCasesHubJsonLd';
import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: UseCasesHubContent,
  JsonLd: UseCasesHubJsonLd,
  path: '/use-cases',
  metaTitleKey: 'useCasesHub.metaTitle',
  metaDescKey: 'useCasesHub.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
