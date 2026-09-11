import PerformanceModesJsonLd from '../../../features/performance-modes/PerformanceModesJsonLd';
import PerformanceModesContent from '../../../features/performance-modes/PerformanceModesContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: PerformanceModesJsonLd,
  Content: PerformanceModesContent,
  path: '/features/performance-modes',
  titleKey: 'featuresPerformance.hero.title',
  descKey: 'featuresPerformance.hero.subtitle',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
