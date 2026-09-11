import NotebooklmJsonLd from '../../../compare/notebooklm/NotebooklmJsonLd';
import NotebooklmContent from '../../../compare/notebooklm/NotebooklmContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: NotebooklmJsonLd,
  Content: NotebooklmContent,
  path: '/compare/notebooklm',
  titleKey: 'compareNotebooklm.heroTitle',
  descKey: 'compareNotebooklm.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
