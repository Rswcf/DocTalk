import type { Metadata } from 'next';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Contact DocTalk Support',
  description:
    'Contact the DocTalk team for product support, billing questions, privacy requests, partnerships, bug reports, or general feedback.',
  path: '/contact',
  openGraph: {
    title: 'Contact DocTalk',
  },
});

export default function ContactPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ContactPage',
            name: 'Contact DocTalk',
            description:
              'Contact information for the DocTalk team covering support, privacy, billing, and partnerships.',
            url: 'https://www.doctalk.site/contact',
            mainEntity: {
              '@type': 'Organization',
              name: 'DocTalk',
              url: 'https://www.doctalk.site',
              email: 'support@doctalk.site',
              logo: 'https://www.doctalk.site/logo-icon.png',
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.doctalk.site' },
              { '@type': 'ListItem', position: 2, name: 'Contact' },
            ],
          }),
        }}
      />
      <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
        <Header variant="minimal" />
        <main id="main-content" className="flex-1 px-6 py-16">
          <div className="max-w-3xl mx-auto space-y-10">
            <section className="space-y-4">
              <p className="text-sm font-medium tracking-[0.18em] uppercase text-zinc-500 dark:text-zinc-400">
                Contact
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Reach the DocTalk team.
              </h1>
              <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
                The fastest way to get in touch is email. We use one inbox for support, privacy, and product
                feedback so requests do not get lost across channels.
              </p>
            </section>

            <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Primary contact
              </h2>
              <p className="text-base leading-8 text-zinc-600 dark:text-zinc-400">
                Email:{' '}
                <a
                  href="mailto:support@doctalk.site"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  support@doctalk.site
                </a>
              </p>
              <p className="text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                Use this address for account support, billing issues, privacy requests, partnership inquiries,
                bug reports, and general product feedback.
              </p>
              <p className="text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                Useful messages include the document type involved, the exact route or screen you were on,
                timestamps, screenshots, and the email address associated with your DocTalk account. That makes
                support much easier to reproduce and resolve without a long back-and-forth.
              </p>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 p-6">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Support & billing</h2>
                <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                  Include the email on your DocTalk account, a short description of the issue, and any relevant
                  screenshots or error messages to speed up resolution.
                </p>
              </div>
              <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 p-6">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Privacy & data</h2>
                <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                  Questions about exported data, deletion requests, or privacy expectations can be sent to the
                  same support inbox for follow-up.
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                When to contact us
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Good reasons to email
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                    <li>Billing questions or upgrade issues</li>
                    <li>Unexpected parsing or citation problems</li>
                    <li>Data deletion or privacy-related requests</li>
                    <li>Partnerships, integrations, or product feedback</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Before you send
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                    <li>Check the demo to confirm expected behavior</li>
                    <li>Include screenshots, URLs, and exact error text</li>
                    <li>Tell us whether the issue is billing, product, or privacy related</li>
                    <li>Use the account email if the request involves account access</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
