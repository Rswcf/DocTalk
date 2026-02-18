import type { Metadata } from 'next';
import FreeDemoClient from './FreeDemoClient';

export const metadata: Metadata = {
  title: 'Try AI Document Chat Free — No Signup Required | DocTalk',
  description:
    'Chat with AI about sample documents instantly. No account, no credit card, no signup. See citation highlighting in action. 3 demo documents ready to explore.',
  alternates: { canonical: '/features/free-demo' },
  openGraph: {
    title: 'Try AI Document Chat Free — No Signup Required | DocTalk',
    description:
      'Chat with AI about sample documents instantly. No account, no credit card, no signup. 3 demo documents ready to explore.',
    url: 'https://www.doctalk.site/features/free-demo',
  },
};

export default function FreeDemoPage() {
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
              { '@type': 'ListItem', position: 3, name: 'Free Demo' },
            ],
          }),
        }}
      />

      {/* SoftwareApplication + Offer */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'DocTalk',
            applicationCategory: 'ProductivityApplication',
            operatingSystem: 'Web',
            url: 'https://www.doctalk.site/demo',
            description:
              'Try DocTalk free with 3 sample documents. No signup required. Experience AI document chat with citation highlighting.',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
              name: 'Free Demo',
              description: 'No signup required. 5 messages per session. 3 sample documents.',
            },
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
                name: 'Is it really free?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. The demo is completely free with no hidden costs. You get 5 messages per session with 3 sample documents. No credit card, no account, no email required.',
                },
              },
              {
                '@type': 'Question',
                name: 'Do I need an account?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'No. The demo works without any account. Just click and start chatting. If you want to upload your own documents, you can create a free account that comes with 500 credits per month.',
                },
              },
              {
                '@type': 'Question',
                name: 'What happens after the demo?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'After the demo, you can create a free account to upload your own documents and get 500 credits per month. Or upgrade to Plus (3,000 credits) or Pro (9,000 credits) for more usage.',
                },
              },
              {
                '@type': 'Question',
                name: 'Can I upload my own documents for free?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. Free accounts can upload up to 3 documents (25MB each) and get 500 credits per month. Sign up with Google, Microsoft, or email — no credit card required.',
                },
              },
              {
                '@type': 'Question',
                name: 'How many credits do I get?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'The demo does not use credits. Free accounts get 500 credits per month. Plus plans get 3,000 credits for $9.99/month, and Pro plans get 9,000 credits for $19.99/month.',
                },
              },
            ],
          }),
        }}
      />

      <FreeDemoClient />
    </>
  );
}
