import ChatpdfAltsJsonLd from '../../../alternatives/chatpdf/ChatpdfAltsJsonLd';
import ChatpdfAltsContent from '../../../alternatives/chatpdf/ChatpdfAltsContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: ChatpdfAltsJsonLd,
  Content: ChatpdfAltsContent,
  path: '/alternatives/chatpdf',
  titleKey: 'altsChatpdf.heroTitle',
  descKey: 'altsChatpdf.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
