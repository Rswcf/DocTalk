import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { absoluteUrl, buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'DocTalk Pricing for Free, Plus, and Pro',
  description:
    'See DocTalk pricing for Free, Plus, and Pro plans. Compare monthly credits, document limits, export features, OCR support, and AI modes.',
  path: '/pricing',
  keywords: [
    'doctalk pricing',
    'ai pdf chat pricing',
    'document ai pricing',
    'chat with pdf pricing',
  ],
  openGraph: {
    title: 'DocTalk Pricing',
  },
});

const plans = [
  {
    name: 'Free',
    price: '$0',
    cadence: '/month',
    summary: 'Best for trying DocTalk with small document sets and core AI chat workflows.',
    features: [
      '500 credits every month',
      '25 MB uploads',
      '3 documents',
      'Quick and Balanced AI modes',
      'Source citations and OCR support',
    ],
    ctaHref: '/auth',
    ctaLabel: 'Start free',
  },
  {
    name: 'Plus',
    price: '$9.99',
    cadence: '/month',
    summary: 'Best for regular research, client work, and document-heavy knowledge tasks.',
    features: [
      '3,000 credits every month',
      '50 MB uploads',
      '20 documents',
      'All 3 AI modes',
      'Markdown export',
    ],
    ctaHref: '/auth?callbackUrl=%2Fbilling',
    ctaLabel: 'Choose Plus',
    featured: true,
  },
  {
    name: 'Pro',
    price: '$19.99',
    cadence: '/month',
    summary: 'Best for power users who need larger file limits, more volume, and custom prompts.',
    features: [
      '9,000 credits every month',
      '100 MB uploads',
      'Unlimited documents',
      'All 3 AI modes',
      'Custom prompts and export',
    ],
    ctaHref: '/auth?callbackUrl=%2Fbilling',
    ctaLabel: 'Choose Pro',
  },
];

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
              { '@type': 'ListItem', position: 2, name: 'Pricing', item: absoluteUrl('/pricing') },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'How do DocTalk credits work?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Credits measure usage across document parsing and AI chat. Free accounts receive 500 credits per month, Plus includes 3,000 credits, and Pro includes 9,000 credits.',
                },
              },
              {
                '@type': 'Question',
                name: 'Which plans include all AI modes?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Plus and Pro include Quick, Balanced, and Thorough modes. Free includes Quick and Balanced.',
                },
              },
              {
                '@type': 'Question',
                name: 'Can I try DocTalk before paying?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. There is a free plan and a public demo so you can test the product before upgrading.',
                },
              },
            ],
          }),
        }}
      />
      <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
        <Header variant="minimal" />
        <main id="main-content" className="flex-1 px-6 py-16">
          <div className="mx-auto max-w-6xl space-y-16">
            <section className="mx-auto max-w-3xl text-center space-y-5">
              <p className="text-sm font-medium tracking-[0.18em] uppercase text-zinc-500 dark:text-zinc-400">
                Pricing
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
                Pricing built around real document work, not vague AI limits.
              </h1>
              <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
                DocTalk is designed for people who need grounded answers from PDFs, DOCX files, slides,
                spreadsheets, and URLs. Every plan includes source citations and OCR support. Higher tiers
                mainly expand usage limits, unlock the Thorough model, and add export or custom prompt
                workflows for heavier research and operations use.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/auth?callbackUrl=%2Fbilling"
                  className="inline-flex items-center rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Start free
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex items-center rounded-lg border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
                >
                  Try the public demo
                </Link>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              {plans.map((plan) => (
                <article
                  key={plan.name}
                  className={`rounded-3xl border p-8 shadow-sm ${
                    plan.featured
                      ? 'border-indigo-500 bg-indigo-50/50 dark:border-indigo-400 dark:bg-indigo-950/20'
                      : 'border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{plan.name}</h2>
                    {plan.featured && (
                      <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white dark:bg-indigo-500">
                        Most popular
                      </span>
                    )}
                  </div>
                  <p className="mt-4 text-sm leading-7 text-zinc-600 dark:text-zinc-400">{plan.summary}</p>
                  <div className="mt-6 flex items-end gap-1">
                    <span className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                      {plan.price}
                    </span>
                    <span className="pb-1 text-sm text-zinc-500 dark:text-zinc-400">{plan.cadence}</span>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-3">
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.ctaHref}
                    className={`mt-8 inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-medium transition-colors ${
                      plan.featured
                        ? 'bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400'
                        : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200'
                    }`}
                  >
                    {plan.ctaLabel}
                  </Link>
                </article>
              ))}
            </section>

            <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-zinc-200 p-8 dark:border-zinc-800">
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  What the plans actually change
                </h2>
                <p className="mt-4 text-base leading-8 text-zinc-600 dark:text-zinc-400">
                  All plans use the same core product: upload a document, ask natural-language questions, and
                  verify answers through source citations. The main differences are usage limits and advanced
                  workflows. Free is enough to understand how DocTalk works. Plus is the practical default for
                  active weekly use. Pro is for people who routinely work with larger files, more documents, and
                  repeatable prompt workflows.
                </p>
                <div className="mt-8 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800">
                        <th scope="col" className="py-3 pr-4 font-medium text-zinc-500 dark:text-zinc-400">Feature</th>
                        <th scope="col" className="py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">Free</th>
                        <th scope="col" className="py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">Plus</th>
                        <th scope="col" className="py-3 pl-4 font-medium text-zinc-500 dark:text-zinc-400">Pro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Monthly credits', '500', '3,000', '9,000'],
                        ['Upload limit', '25 MB', '50 MB', '100 MB'],
                        ['Document limit', '3', '20', 'Unlimited'],
                        ['AI modes', 'Quick + Balanced', 'All 3 modes', 'All 3 modes'],
                        ['Export', 'No', 'Markdown', 'Markdown + custom prompts'],
                      ].map(([label, free, plus, pro]) => (
                        <tr key={label} className="border-b border-zinc-100 dark:border-zinc-900">
                          <th scope="row" className="py-3 pr-4 font-medium text-zinc-700 dark:text-zinc-300">{label}</th>
                          <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{free}</td>
                          <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{plus}</td>
                          <td className="py-3 pl-4 text-zinc-600 dark:text-zinc-400">{pro}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <aside className="rounded-3xl bg-zinc-50 p-8 dark:bg-zinc-900/60">
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Best fit by workflow
                </h2>
                <ul className="mt-5 space-y-4 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                  <li>
                    <strong className="text-zinc-900 dark:text-zinc-100">Free:</strong> evaluating product fit,
                    reading a few papers, or testing citation reliability before commitment.
                  </li>
                  <li>
                    <strong className="text-zinc-900 dark:text-zinc-100">Plus:</strong> recurring contract review,
                    report analysis, coursework, and weekly knowledge workflows.
                  </li>
                  <li>
                    <strong className="text-zinc-900 dark:text-zinc-100">Pro:</strong> larger, repeated workloads
                    where export, custom prompts, and higher volume save meaningful time.
                  </li>
                </ul>
                <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                    Need more context before choosing? Start with the{' '}
                    <Link href="/demo" className="text-indigo-600 hover:underline dark:text-indigo-400">
                      public demo
                    </Link>
                    , read the{' '}
                    <Link href="/features" className="text-indigo-600 hover:underline dark:text-indigo-400">
                      feature overview
                    </Link>
                    , or compare DocTalk with alternatives on the{' '}
                    <Link href="/compare" className="text-indigo-600 hover:underline dark:text-indigo-400">
                      comparison hub
                    </Link>
                    .
                  </p>
                </div>
              </aside>
            </section>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
