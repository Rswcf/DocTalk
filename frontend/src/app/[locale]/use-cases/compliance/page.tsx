import ComplianceContent from '../../../use-cases/compliance/ComplianceContent';
import ComplianceJsonLd from '../../../use-cases/compliance/ComplianceJsonLd';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: ComplianceContent,
  JsonLd: ComplianceJsonLd,
  path: '/use-cases/compliance',
  metaTitleKey: 'useCasesCompliance.metaTitle',
  metaDescKey: 'useCasesCompliance.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
