import ConsultantsContent from '../../../use-cases/consultants/ConsultantsContent';
import ConsultantsJsonLd from '../../../use-cases/consultants/ConsultantsJsonLd';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: ConsultantsContent,
  JsonLd: ConsultantsJsonLd,
  path: '/use-cases/consultants',
  titleKey: 'useCasesConsultants.heroTitle',
  descKey: 'useCasesConsultants.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
