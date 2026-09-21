import LawyersContent from '../../../use-cases/lawyers/LawyersContent';
import LawyersJsonLd from '../../../use-cases/lawyers/LawyersJsonLd';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

// Hand-written before the helper existed, this page read its metadata from the
// hero's own keys, so a headline rewrite would have moved its search title in
// ten locales (Phase 2a review, M1). It now goes through the helper like every
// other localized marketing page; the two meta keys were seeded from the hero
// values rendered at the time, so the metadata is unchanged.
const page = createMarketingLocalePage({
  Content: LawyersContent,
  JsonLd: LawyersJsonLd,
  path: '/use-cases/lawyers',
  metaTitleKey: 'useCasesLawyers.metaTitle',
  metaDescKey: 'useCasesLawyers.metaDescription',
  keywords: ['ai for lawyers', 'legal document ai', 'contract analysis ai', 'legal pdf reader'],
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
