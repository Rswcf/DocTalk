import StudentsContent from '../../../use-cases/students/StudentsContent';
import StudentsJsonLd from '../../../use-cases/students/StudentsJsonLd';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: StudentsContent,
  JsonLd: StudentsJsonLd,
  path: '/use-cases/students',
  metaTitleKey: 'useCasesStudents.metaTitle',
  metaDescKey: 'useCasesStudents.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
