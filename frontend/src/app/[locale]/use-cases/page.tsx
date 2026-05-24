import UseCasesHubContent from '../../use-cases/UseCasesHubContent';
import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: UseCasesHubContent,
  path: '/use-cases',
  titleKey: 'useCasesHub.heroTitle',
  descKey: 'useCasesHub.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
