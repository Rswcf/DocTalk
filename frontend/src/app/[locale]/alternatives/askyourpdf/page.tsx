import AskyourpdfAltsContent from '../../../alternatives/askyourpdf/AskyourpdfAltsContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: AskyourpdfAltsContent,
  path: '/alternatives/askyourpdf',
  titleKey: 'altsAskyourpdf.heroTitle',
  descKey: 'altsAskyourpdf.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
