import type { Metadata } from 'next';
import PerformanceModesClient from './PerformanceModesClient';

export const metadata: Metadata = {
  title: '3 AI Performance Modes: Quick, Balanced, Thorough | DocTalk',
  description:
    'Choose your AI speed and depth. Quick for fast answers, Balanced for everyday use, Thorough for deep analysis. Powered by DeepSeek, Mistral Medium, and Mistral Large.',
  alternates: { canonical: '/features/performance-modes' },
  openGraph: {
    title: '3 AI Performance Modes: Quick, Balanced, Thorough | DocTalk',
    description:
      'Choose your AI speed and depth. Quick for fast answers, Balanced for everyday use, Thorough for deep analysis.',
    url: 'https://www.doctalk.site/features/performance-modes',
  },
};

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
              'AI document chat with 3 performance modes: Quick (DeepSeek V3.2), Balanced (Mistral Medium 3.1), and Thorough (Mistral Large 2512).',
            offers: [
              { '@type': 'Offer', price: '0', priceCurrency: 'USD', name: 'Free', description: 'Quick + Balanced modes, 500 credits/month' },
              { '@type': 'Offer', price: '9.99', priceCurrency: 'USD', name: 'Plus', description: 'All 3 modes, 3000 credits/month' },
              { '@type': 'Offer', price: '19.99', priceCurrency: 'USD', name: 'Pro', description: 'All 3 modes, 9000 credits/month' },
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
                name: 'What is the difference between the three modes?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Quick mode uses DeepSeek V3.2 for fast, concise answers at 2 credits per question. Balanced mode uses Mistral Medium 3.1 for detailed everyday answers at 8 credits. Thorough mode uses Mistral Large 2512 for deep, nuanced analysis at 24 credits.',
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
                name: 'Is Thorough mode available on the free plan?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Thorough mode requires a Plus or Pro subscription. Free accounts have access to Quick and Balanced modes with 500 credits per month.',
                },
              },
              {
                '@type': 'Question',
                name: 'Which mode should I use?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Use Quick for simple factual lookups and quick summaries. Use Balanced for general Q&A, explanations, and most everyday tasks. Use Thorough for complex analysis, multi-part questions, and when you need the most comprehensive answer.',
                },
              },
            ],
          }),
        }}
      />

      <PerformanceModesClient />
    </>
  );
}
