import PerformanceModesJsonLd from '../../../features/performance-modes/PerformanceModesJsonLd';
import PerformanceModesContent from '../../../features/performance-modes/PerformanceModesContent';
import { createMarketingLocalePage } from '../../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  JsonLd: PerformanceModesJsonLd,
  Content: PerformanceModesContent,
  path: '/features/performance-modes',
  metaTitleKey: 'featuresPerformance.metaTitle',
  metaDescKey: 'featuresPerformance.metaDescription',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
