import CitationsJsonLd from '../../../features/citations/CitationsJsonLd';
import CitationsContent from '../../../features/citations/CitationsContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: CitationsJsonLd,
  Content: CitationsContent,
  path: '/features/citations',
  metaTitleKey: 'featuresCitations.metaTitle',
  metaDescKey: 'featuresCitations.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
