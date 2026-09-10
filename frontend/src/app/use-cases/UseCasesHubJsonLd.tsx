import { getServerT } from '../../i18n/server';
import MarketingPageJsonLd from '../../components/marketing/MarketingPageJsonLd';

export default async function UseCasesHubJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/use-cases"
      title={t('useCasesHub.heroTitle')}
      description={t('useCasesHub.heroDescription')}
      breadcrumbs={[
        { label: t('useCasesHub.breadcrumb.home'), path: '/' },
        { label: t('footer.links.useCases') },
      ]}
    />
  );
}
