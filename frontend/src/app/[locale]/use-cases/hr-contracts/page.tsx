import HrContractsContent from '../../../use-cases/hr-contracts/HrContractsContent';
import HrContractsJsonLd from '../../../use-cases/hr-contracts/HrContractsJsonLd';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: HrContractsContent,
  JsonLd: HrContractsJsonLd,
  path: '/use-cases/hr-contracts',
  metaTitleKey: 'useCasesHr.metaTitle',
  metaDescKey: 'useCasesHr.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
