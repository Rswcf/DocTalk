import { getServerT } from '../../i18n/server';
import MarketingPageJsonLd from '../../components/marketing/MarketingPageJsonLd';
import JsonLdScript from '../../components/JsonLdScript';
import { localizedHrefIfAvailable } from '../../i18n/routing';
import { absoluteUrl } from '../../lib/seo';

export default async function ToolsHubJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  return (
    <>
      <MarketingPageJsonLd
        locale={locale}
        path="/tools"
        title={t('toolsHub.heroTitle')}
        description={t('toolsHub.heroLede')}
        breadcrumbs={[
          { label: t('toolsHub.breadcrumbHome'), path: '/' },
          { label: t('toolsHub.breadcrumbTools') },
        ]}
      />
      <JsonLdScript data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        inLanguage: locale,
        name: t('toolsHub.heroTitle'),
        description: t('toolsHub.heroLede'),
        url: absoluteUrl(localizedHrefIfAvailable(locale, '/tools')),
        isPartOf: {
          '@type': 'WebSite',
          name: 'DocTalk',
          url: absoluteUrl(localizedHrefIfAvailable(locale, '/')),
        },
      }} />
    </>
  );
}
