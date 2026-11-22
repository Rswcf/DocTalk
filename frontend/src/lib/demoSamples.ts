// The three public sample documents, as the marketing surface links to them.
// `slug` is the backend's DEMO_DOCS slug (GET /api/documents/demo), `route` the
// short `/demo/<route>` alias DemoRedirectPageClient resolves to a document id,
// and `questionKey` the suggested question /demo and the landing chips ask.
// One list, so the hero chips and the /demo cards never ask different things.

export interface DemoSample {
  slug: 'alphabet-earnings' | 'attention-paper' | 'court-filing';
  route: 'earnings' | 'paper' | 'court';
  questionKey: string;
  /** Short chip label on the landing hero. */
  chipKey: string;
  chipFallback: string;
}

export const DEMO_SAMPLES: readonly DemoSample[] = [
  {
    slug: 'alphabet-earnings',
    route: 'earnings',
    questionKey: 'demo.sample.earnings.question',
    chipKey: 'landing.entry.sample.earnings',
    chipFallback: 'Earnings release',
  },
  {
    slug: 'attention-paper',
    route: 'paper',
    questionKey: 'demo.sample.paper.question',
    chipKey: 'landing.entry.sample.paper',
    chipFallback: 'Research paper',
  },
  {
    slug: 'court-filing',
    route: 'court',
    questionKey: 'demo.sample.court.question',
    chipKey: 'landing.entry.sample.court',
    chipFallback: 'Court filing',
  },
];

export function demoQuestionKey(slug: DemoSample['slug']): string {
  return DEMO_SAMPLES.find((s) => s.slug === slug)!.questionKey;
}

/** Longest `?question=` the /demo/<route> redirect forwards to the reader. */
export const DEMO_QUESTION_MAX = 300;

/** `/demo/<route>?question=…`: the redirect resolves the document id, then
 *  opens the reader with the question, which the reader asks on arrival. */
export function demoSampleHref(sample: DemoSample, question: string): string {
  const q = question.trim().slice(0, DEMO_QUESTION_MAX);
  return q ? `/demo/${sample.route}?question=${encodeURIComponent(q)}` : `/demo/${sample.route}`;
}
