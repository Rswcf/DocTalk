import { notFound } from 'next/navigation';
import { URL_LOCALES, isUrlLocale } from '../../i18n/routing';

/**
 * Locale subdirectory for the server-rendered, internationalized marketing
 * surface (`/de/...`, `/ja/...`). English stays unprefixed at the root, so this
 * segment only ever serves the high-value URL locales. `dynamicParams = false`
 * means any non-listed segment (e.g. `/random`) 404s at build instead of being
 * dynamically rendered.
 *
 * Only the marketing pages are mirrored here; the authenticated app (root `/`,
 * `/d/`, `/collections`, …) is intentionally NOT localized by URL.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return URL_LOCALES.map((locale) => ({ locale }));
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!isUrlLocale(params.locale)) notFound();
  return <>{children}</>;
}
