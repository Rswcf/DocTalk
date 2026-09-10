import TeachersContent from '../../../use-cases/teachers/TeachersContent';
import TeachersJsonLd from '../../../use-cases/teachers/TeachersJsonLd';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: TeachersContent,
  JsonLd: TeachersJsonLd,
  path: '/use-cases/teachers',
  titleKey: 'useCasesTeachers.heroTitle',
  descKey: 'useCasesTeachers.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
