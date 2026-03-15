import type { Metadata } from 'next';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'About DocTalk: Verified AI Document Chat',
  description:
    'Learn what DocTalk does, who it is for, how it approaches trustworthy AI document analysis, and how to contact the team.',
  path: '/about',
  openGraph: {
    title: 'About DocTalk',
  },
});

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'AboutPage',
            name: 'About DocTalk',
            description:
              'Background on DocTalk, its product mission, and its approach to trustworthy AI document analysis.',
            url: 'https://www.doctalk.site/about',
            mainEntity: {
              '@type': 'Organization',
              name: 'DocTalk',
              url: 'https://www.doctalk.site',
              logo: 'https://www.doctalk.site/logo-icon.png',
              sameAs: ['https://github.com/Rswcf/DocTalk'],
              contactPoint: {
                '@type': 'ContactPoint',
                email: 'support@doctalk.site',
                contactType: 'customer support',
              },
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
              { '@type': 'ListItem', position: 2, name: 'About' },
            ],
          }),
        }}
      />
      <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
        <Header variant="minimal" />
        <main id="main-content" className="flex-1 px-6 py-16">
          <div className="max-w-3xl mx-auto space-y-12">
            <section className="space-y-4">
              <p className="text-sm font-medium tracking-[0.18em] uppercase text-zinc-500 dark:text-zinc-400">
                About DocTalk
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                AI document chat designed for answers you can verify.
              </h1>
              <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
                DocTalk helps people read dense documents faster without giving up traceability. Upload a PDF,
                DOCX, PPTX, XLSX, TXT, Markdown file, or public URL, ask natural-language questions, and jump
                back to the cited source passage in one click.
              </p>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">What we optimize for</h2>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                  <li>Verifiable answers with citations that point to the original source text.</li>
                  <li>Support for real document workflows, not just PDFs.</li>
                  <li>Fast onboarding, including a public demo that works before signup.</li>
                  <li>Privacy-first handling for uploaded files and account data.</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Who uses DocTalk</h2>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                  <li>Students and researchers reviewing papers and technical sources.</li>
                  <li>Legal, finance, and HR teams working through long, detail-heavy documents.</li>
                  <li>Operators and founders who need quick answers from contracts, decks, and reports.</li>
                  <li>Anyone who wants AI help without losing the ability to check the source.</li>
                </ul>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Trust, privacy, and product direction
              </h2>
              <p className="text-base leading-8 text-zinc-600 dark:text-zinc-400">
                DocTalk is built around retrieval-augmented generation so answers stay grounded in the uploaded
                document. The product supports citation highlighting, multiple performance modes, and document
                workflows across several formats. Uploaded documents are encrypted in transit and at rest, and
                users can manage or delete their data from the app.
              </p>
              <p className="text-base leading-8 text-zinc-600 dark:text-zinc-400">
                The current public product focuses on English SEO pages, while the application interface supports
                11 languages. Product updates, comparisons, and practical guides are published on the blog as the
                product evolves.
              </p>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">How the product works</h2>
                <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                  Behind the interface, DocTalk combines document parsing, chunking, retrieval, and language
                  model generation so answers stay connected to the original file. That architecture matters
                  because the product is not trying to replace the source document. It is trying to shorten the
                  path from question to verifiable evidence inside the document you already have.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">What we publish</h2>
                <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                  Public pages on DocTalk focus on practical product education: feature explainers, use cases,
                  software comparisons, and blog posts about AI document workflows. The goal is straightforward:
                  help users understand where the product is strong, where citations matter, and which workflow
                  the tool is actually suited for before they sign up.
                </p>
              </div>
            </section>

            <section className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Contact</h2>
              <p className="mt-3 text-base leading-8 text-zinc-600 dark:text-zinc-400">
                Questions about the product, partnerships, privacy, or support can be sent to{' '}
                <a
                  href="mailto:support@doctalk.site"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  support@doctalk.site
                </a>
                . You can also find the public codebase on{' '}
                <a
                  href="https://github.com/Rswcf/DocTalk"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  GitHub
                </a>
                .
              </p>
              <p className="mt-3 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                If you are evaluating DocTalk for a real workflow, the fastest way to build context is to start
                with the public demo, then review the pricing and feature pages. Those pages show the current
                product surface more accurately than generic AI-tool directories.
              </p>
            </section>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
