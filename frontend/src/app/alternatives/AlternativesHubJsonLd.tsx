import { getServerT } from '../../i18n/server';
import MarketingPageJsonLd from '../../components/marketing/MarketingPageJsonLd';

export default async function AlternativesHubJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/alternatives"
      title={t('altsHub.title')}
      description={t('altsHub.subtitle')}
      breadcrumbs={[
        { label: t('useCasesHub.breadcrumb.home'), path: '/' },
        { label: t('altsHub.title') },
      ]}
    />
  );
}
