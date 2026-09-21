import ChatpdfJsonLd from '../../../compare/chatpdf/ChatpdfJsonLd';
import ChatpdfContent from '../../../compare/chatpdf/ChatpdfContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: ChatpdfJsonLd,
  Content: ChatpdfContent,
  path: '/compare/chatpdf',
  metaTitleKey: 'compareChatpdf.metaTitle',
  metaDescKey: 'compareChatpdf.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
