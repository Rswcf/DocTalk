import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LandingPageContent from '../../components/landing/LandingPageContent';
import LocaleProvider from '../../i18n/LocaleProvider';
import MarketingLocaleLinks from '../../components/marketing/MarketingLocaleLinks';
import { getServerT, getScopedMessages } from '../../i18n/server';
import { buildMarketingMetadata } from '../../lib/seo';
import HomeJsonLd from '../HomeJsonLd';
import { isUrlLocale } from '../../i18n/routing';

// Namespaces the landing tree (header + sections + footer + HeroArtifact) reads.
// Seeding only these keeps the hydration payload ~17KB instead of the full 400KB.
const LANDING_PREFIXES = [
  'landing.', 'hero.', 'chat.', 'footer.', 'privacy.', 'terms.', 'public.', 'auth.', 'header.', 'common.',
] as const;

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const { t } = await getServerT(params.locale);
  const title = t('landing.metaTitle').replace(/\s*\n\s*/g, ' ').trim();
  const description = t('landing.metaDescription');
  return buildMarketingMetadata({
    title: { absolute: `${title} | DocTalk` },
    description,
    path: '/',
    locale: params.locale,
    localized: true,
    openGraph: { title: `${title} | DocTalk`, description, type: 'website' },
  });
}

export default async function LocaleLandingPage({ params }: { params: { locale: string } }) {
  if (!isUrlLocale(params.locale)) notFound();
  const { locale } = params;
  const { t } = await getServerT(locale);
  const messages = await getScopedMessages(locale, LANDING_PREFIXES);


  return (
    <>
      <HomeJsonLd locale={locale} />
      <LocaleProvider initialLocale={locale} initialMessages={messages}>
        <LandingPageContent />
      </LocaleProvider>
      <MarketingLocaleLinks path="/" label={t('header.language')} />
    </>
  );
}
