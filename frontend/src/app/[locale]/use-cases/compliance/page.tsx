import ComplianceContent from '../../../use-cases/compliance/ComplianceContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: ComplianceContent,
  path: '/use-cases/compliance',
  titleKey: 'useCasesCompliance.heroTitle',
  descKey: 'useCasesCompliance.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
