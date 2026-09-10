import StudentsContent from '../../../use-cases/students/StudentsContent';
import StudentsJsonLd from '../../../use-cases/students/StudentsJsonLd';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: StudentsContent,
  JsonLd: StudentsJsonLd,
  path: '/use-cases/students',
  titleKey: 'useCasesStudents.hero.title',
  descKey: 'useCasesStudents.hero.subtitle',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
