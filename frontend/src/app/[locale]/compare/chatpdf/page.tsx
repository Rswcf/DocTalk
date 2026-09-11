import ChatpdfJsonLd from '../../../compare/chatpdf/ChatpdfJsonLd';
import ChatpdfContent from '../../../compare/chatpdf/ChatpdfContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: ChatpdfJsonLd,
  Content: ChatpdfContent,
  path: '/compare/chatpdf',
  titleKey: 'compareChatpdf.heroTitle',
  descKey: 'compareChatpdf.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
