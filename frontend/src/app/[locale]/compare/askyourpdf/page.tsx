import AskyourpdfContent from '../../../compare/askyourpdf/AskyourpdfContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: AskyourpdfContent,
  path: '/compare/askyourpdf',
  titleKey: 'compareAskyourpdf.heroTitle',
  descKey: 'compareAskyourpdf.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
