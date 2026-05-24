import HrContractsContent from '../../../use-cases/hr-contracts/HrContractsContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: HrContractsContent,
  path: '/use-cases/hr-contracts',
  titleKey: 'useCasesHr.hero.title',
  descKey: 'useCasesHr.hero.subtitle',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
