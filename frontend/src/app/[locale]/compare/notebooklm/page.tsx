import NotebooklmJsonLd from '../../../compare/notebooklm/NotebooklmJsonLd';
import NotebooklmContent from '../../../compare/notebooklm/NotebooklmContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: NotebooklmJsonLd,
  Content: NotebooklmContent,
  path: '/compare/notebooklm',
  metaTitleKey: 'compareNotebooklm.metaTitle',
  metaDescKey: 'compareNotebooklm.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
