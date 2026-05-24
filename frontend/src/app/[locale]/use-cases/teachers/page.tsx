import TeachersContent from '../../../use-cases/teachers/TeachersContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: TeachersContent,
  path: '/use-cases/teachers',
  titleKey: 'useCasesTeachers.heroTitle',
  descKey: 'useCasesTeachers.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
