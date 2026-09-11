import AskyourpdfJsonLd from '../../../compare/askyourpdf/AskyourpdfJsonLd';
import AskyourpdfContent from '../../../compare/askyourpdf/AskyourpdfContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: AskyourpdfJsonLd,
  Content: AskyourpdfContent,
  path: '/compare/askyourpdf',
  titleKey: 'compareAskyourpdf.heroTitle',
  descKey: 'compareAskyourpdf.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
