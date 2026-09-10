import FinanceContent from '../../../use-cases/finance/FinanceContent';
import FinanceJsonLd from '../../../use-cases/finance/FinanceJsonLd';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: FinanceContent,
  JsonLd: FinanceJsonLd,
  path: '/use-cases/finance',
  titleKey: 'useCasesFinance.heroTitle',
  descKey: 'useCasesFinance.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
