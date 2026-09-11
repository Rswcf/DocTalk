import { getServerT } from '../../i18n/server';
import MarketingPageJsonLd from '../../components/marketing/MarketingPageJsonLd';

export default async function DemoJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/demo"
      title={t('demo.title')}
      description={t('demo.subtitle')}
      breadcrumbs={[
        { label: t('useCasesHub.breadcrumb.home'), path: '/' },
        { label: t('footer.demo') },
      ]}
    />
  );
}
