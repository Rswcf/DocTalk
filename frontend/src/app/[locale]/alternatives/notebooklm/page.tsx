import NotebooklmAltsJsonLd from '../../../alternatives/notebooklm/NotebooklmAltsJsonLd';
import NotebooklmAltsContent from '../../../alternatives/notebooklm/NotebooklmAltsContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: NotebooklmAltsJsonLd,
  Content: NotebooklmAltsContent,
  path: '/alternatives/notebooklm',
  metaTitleKey: 'altsNotebooklm.metaTitle',
  metaDescKey: 'altsNotebooklm.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
