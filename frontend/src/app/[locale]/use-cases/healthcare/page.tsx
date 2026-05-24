import HealthcareContent from '../../../use-cases/healthcare/HealthcareContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: HealthcareContent,
  path: '/use-cases/healthcare',
  titleKey: 'useCasesHealthcare.heroTitle',
  descKey: 'useCasesHealthcare.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
