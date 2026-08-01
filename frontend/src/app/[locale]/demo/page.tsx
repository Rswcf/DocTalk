import { notFound } from 'next/navigation';
import DemoPageClient from '../../demo/DemoPageClient';
import LocaleProvider from '../../../i18n/LocaleProvider';
import { getScopedMessages } from '../../../i18n/server';
import { isUrlLocale } from '../../../i18n/routing';
import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';

// Namespaces DemoPageClient's tree reads: the page content itself (`demo.`),
// the breadcrumb ("Home" crumb), retry/loading copy, and — since MarketingShell
// renders the header/footer without a server `chrome` prop here — everything
// EditorialHeaderBase/EditorialFooter fall back to via client `useLocale()`
// (nav, auth, language switcher, aria labels, masthead tagline, legal links).
// Mirrors `LANDING_PREFIXES` in app/[locale]/page.tsx for the same reason.
const DEMO_PREFIXES = [
  'demo.',
  'footer.',
  'useCasesHub.breadcrumb.',
  'common.',
  'public.',
  'auth.',
  'header.',
  'landing.',
  'privacy.',
  'terms.',
] as const;

// DemoPageClient is a client component (fetches demo docs, has interactive
// state), so — unlike the pure-server `Content` components other localized
// pages use (e.g. TrustPageContent) — it needs a `LocaleProvider` seeded with
// server-resolved messages for its SSR HTML to be translated. Without this,
// `/de/demo` would serve English until client hydration, defeating the
// locale-URL program's crawler-visibility goal. Same mechanism as the root
// `/[locale]/page.tsx` (LocaleProvider + getScopedMessages).
async function DemoContent({ locale }: { locale: string }) {
  if (!isUrlLocale(locale)) notFound();
  const messages = await getScopedMessages(locale, DEMO_PREFIXES);
  return (
    <LocaleProvider initialLocale={locale} initialMessages={messages}>
      <DemoPageClient />
    </LocaleProvider>
  );
}

const page = createMarketingLocalePage({
  Content: DemoContent,
  path: '/demo',
  titleKey: 'demo.title',
  descKey: 'demo.subtitle',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
