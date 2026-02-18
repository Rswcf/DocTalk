import type { Metadata } from 'next';
import MultilingualClient from './MultilingualClient';

export const metadata: Metadata = {
  title: 'AI Document Chat in 11 Languages | DocTalk',
  description:
    'Chat with documents in English, Chinese, Japanese, Spanish, German, French, Korean, Portuguese, Italian, Arabic, and Hindi. AI understands your language.',
  alternates: { canonical: '/features/multilingual' },
  openGraph: {
    title: 'AI Document Chat in 11 Languages | DocTalk',
    description:
      'Chat with documents in English, Chinese, Japanese, Spanish, German, French, Korean, Portuguese, Italian, Arabic, and Hindi.',
    url: 'https://www.doctalk.site/features/multilingual',
  },
};

export default function MultilingualPage() {
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
              { '@type': 'ListItem', position: 3, name: 'Multilingual' },
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
              'AI document chat supporting 11 languages: English, Chinese, Japanese, Spanish, German, French, Korean, Portuguese, Italian, Arabic, and Hindi.',
            inLanguage: ['en', 'zh', 'ja', 'es', 'de', 'fr', 'ko', 'pt', 'it', 'ar', 'hi'],
            offers: [
              { '@type': 'Offer', price: '0', priceCurrency: 'USD', name: 'Free', description: '500 credits/month' },
              { '@type': 'Offer', price: '9.99', priceCurrency: 'USD', name: 'Plus', description: '3000 credits/month' },
              { '@type': 'Offer', price: '19.99', priceCurrency: 'USD', name: 'Pro', description: '9000 credits/month' },
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
                name: 'Can I ask questions in a different language than the document?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. DocTalk supports cross-language analysis. You can upload a document in Chinese and ask questions in English, or upload an English report and ask in Japanese. The AI understands multiple languages and responds in your preferred language.',
                },
              },
              {
                '@type': 'Question',
                name: 'Does DocTalk support Chinese, Japanese, and Korean PDFs?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. DocTalk includes full CJK (Chinese, Japanese, Korean) PDF support with proper character rendering using CMap and standard font files. Characters display correctly regardless of the PDF encoding.',
                },
              },
              {
                '@type': 'Question',
                name: 'Which languages does the interface support?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'The entire DocTalk interface is available in 11 languages: English, Chinese (Simplified), Japanese, Spanish, German, French, Korean, Portuguese, Italian, Arabic, and Hindi. Switch languages anytime from the language selector.',
                },
              },
              {
                '@type': 'Question',
                name: 'Is multilingual chat available on the free plan?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. All 11 languages are available on every plan, including the free tier with 500 credits per month. There is no language restriction on any plan.',
                },
              },
            ],
          }),
        }}
      />

      <MultilingualClient />
    </>
  );
}
