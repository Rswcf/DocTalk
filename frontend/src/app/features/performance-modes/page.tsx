import type { Metadata } from 'next';
import PerformanceModesContent from './PerformanceModesContent';
import PerformanceModesJsonLd from './PerformanceModesJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Flash and Pro AI Modes',
  description:
    'Choose Flash or Pro mode for AI document chat. Match response speed, depth, and cost to the task at hand.',
  path: '/features/performance-modes',
  localized: true,
  keywords: ['ai performance modes', 'flash pro ai modes', 'ai model selection'],
  openGraph: {
    title: 'Flash and Pro AI Modes | DocTalk',
    description:
      'Choose your AI speed and depth. Flash for fast answers, Pro for deeper document analysis.',
  },
});

export default function PerformanceModesPage() {
  return (
    <>
      <PerformanceModesJsonLd locale="en" />
      <PerformanceModesContent locale="en" />
    </>
  );
}
