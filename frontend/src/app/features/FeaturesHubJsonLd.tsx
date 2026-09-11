import { getServerT } from '../../i18n/server';
import MarketingPageJsonLd from '../../components/marketing/MarketingPageJsonLd';

export default async function FeaturesHubJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/features"
      title={t('featuresHub.heroTitle')}
      description={t('featuresHub.heroSubtitle')}
      breadcrumbs={[
        { label: t('useCasesHub.breadcrumb.home'), path: '/' },
        { label: t('featuresHub.heroTitle') },
      ]}
    />
  );
}
