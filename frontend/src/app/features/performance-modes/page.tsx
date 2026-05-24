import type { Metadata } from 'next';
import PerformanceModesContent from './PerformanceModesContent';
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
      {/* BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.doctalk.site' },
              { '@type': 'ListItem', position: 2, name: 'Features', item: 'https://www.doctalk.site/features' },
              { '@type': 'ListItem', position: 3, name: 'Performance Modes' },
            ],
          }),
        }}
      />

      {/* SoftwareApplication */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'DocTalk',
            applicationCategory: 'ProductivityApplication',
            operatingSystem: 'Web',
            url: 'https://www.doctalk.site',
            description:
              'AI document chat with 2 performance modes: Flash (DeepSeek V4 Flash) and Pro (DeepSeek V4 Pro).',
            offers: [
              { '@type': 'Offer', price: '0', priceCurrency: 'USD', name: 'Free', description: 'Flash + limited Pro modes, 300 credits/month' },
              { '@type': 'Offer', price: '9.99', priceCurrency: 'USD', name: 'Plus', description: 'Flash and Pro modes, 3000 credits/month' },
              { '@type': 'Offer', price: '19.99', priceCurrency: 'USD', name: 'Pro', description: 'Flash and Pro modes, 9000 credits/month' },
            ],
          }),
        }}
      />

      {/* FAQPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'What is the difference between Flash and Pro modes?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Flash mode uses DeepSeek V4 Flash for fast cited answers. Pro mode uses DeepSeek V4 Pro for more careful, detailed document analysis.',
                },
              },
              {
                '@type': 'Question',
                name: 'Can I switch modes during a conversation?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. You can switch between modes at any time using the mode selector in the header. Each message is charged based on the mode used for that specific message.',
                },
              },
              {
                '@type': 'Question',
                name: 'Is Pro mode available on the free plan?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Free accounts have Flash mode plus up to 20 Pro answers per month with 300 credits per month. Plus and Pro plans remove that Pro-mode monthly cap.',
                },
              },
              {
                '@type': 'Question',
                name: 'Which mode should I use?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Use Flash for simple factual lookups and quick summaries. Use Pro for general Q&A, explanations, comparisons, and questions where citation precision matters more than speed.',
                },
              },
            ],
          }),
        }}
      />

      <PerformanceModesContent locale="en" />
    </>
  );
}
