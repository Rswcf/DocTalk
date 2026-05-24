import ConsultantsContent from '../../../use-cases/consultants/ConsultantsContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: ConsultantsContent,
  path: '/use-cases/consultants',
  titleKey: 'useCasesConsultants.heroTitle',
  descKey: 'useCasesConsultants.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
