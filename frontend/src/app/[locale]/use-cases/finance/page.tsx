import FinanceContent from '../../../use-cases/finance/FinanceContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: FinanceContent,
  path: '/use-cases/finance',
  titleKey: 'useCasesFinance.heroTitle',
  descKey: 'useCasesFinance.heroDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
