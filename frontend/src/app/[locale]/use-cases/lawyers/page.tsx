import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LawyersContent from '../../../use-cases/lawyers/LawyersContent';
import LawyersJsonLd from '../../../use-cases/lawyers/LawyersJsonLd';
import { buildMarketingMetadata } from '../../../../lib/seo';
import { isUrlLocale } from '../../../../i18n/routing';
import { getServerT } from '../../../../i18n/server';

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const { t } = await getServerT(params.locale);
  return buildMarketingMetadata({
    title: t('useCasesLawyers.heroTitle'),
    description: t('useCasesLawyers.heroDescription'),
    path: '/use-cases/lawyers',
    locale: params.locale,
    localized: true,
    keywords: ['ai for lawyers', 'legal document ai', 'contract analysis ai', 'legal pdf reader'],
    openGraph: {
      title: `${t('useCasesLawyers.heroTitle')} | DocTalk`,
      description: t('useCasesLawyers.heroDescription'),
    },
  });
}

export default function LawyersLocalePage({ params }: { params: { locale: string } }) {
  if (!isUrlLocale(params.locale)) notFound();
  return (
    <>
      <LawyersJsonLd locale={params.locale} />
      <LawyersContent locale={params.locale} />
    </>
  );
}
