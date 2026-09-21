import TeachersContent from '../../../use-cases/teachers/TeachersContent';
import TeachersJsonLd from '../../../use-cases/teachers/TeachersJsonLd';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: TeachersContent,
  JsonLd: TeachersJsonLd,
  path: '/use-cases/teachers',
  metaTitleKey: 'useCasesTeachers.metaTitle',
  metaDescKey: 'useCasesTeachers.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
