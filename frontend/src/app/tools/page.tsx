import type { Metadata } from 'next';
import ToolsHubContent from './ToolsHubContent';
import ToolsHubJsonLd from './ToolsHubJsonLd';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Free AI Document Tools',
  description:
    'Free online document tools: word counter, reading time calculator, and more. No sign-up required. Powered by DocTalk.',
  path: '/tools',
  localized: true,
  keywords: [
    'free document tools',
    'free pdf tools online',
    'ai document utilities',
    'online text tools',
    'document analysis tools free',
  ],
  openGraph: {
    title: 'Free AI Document Tools | DocTalk',
  },
});

export default function ToolsHubPage() {
  return (
    <>
      <ToolsHubJsonLd locale="en" />
      <ToolsHubContent locale="en" />
    </>
  );
}
