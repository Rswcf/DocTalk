import HealthcareContent from '../../../use-cases/healthcare/HealthcareContent';
import HealthcareJsonLd from '../../../use-cases/healthcare/HealthcareJsonLd';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: HealthcareContent,
  JsonLd: HealthcareJsonLd,
  path: '/use-cases/healthcare',
  titleKey: 'useCasesHealthcare.heroTitle',
  descKey: 'useCasesHealthcare.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
