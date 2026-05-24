import { MARKETING_LOCALES, localizedHref } from '../../i18n/routing';
import { LOCALES } from '../../i18n';

/**
 * Server-rendered, crawlable alternate-language links for a localized marketing
 * page. The interactive header dropdown (`EdLanguageSelector`) is mounted in a
 * click-triggered portal, so its anchors are NOT in the initial HTML — crawlers
 * never click. This component puts the real `<a href="/de/...">` anchors in the
 * static markup (visually hidden) so search engines can follow them to every
 * language version. Belt-and-suspenders alongside hreflang + sitemap (and the
 * primary discovery path for engines that handle hreflang poorly, e.g. Baidu).
 *
 * `path` is the locale-agnostic path (e.g. `/use-cases/lawyers`).
 */
export default function MarketingLocaleLinks({ path }: { path: string }) {
  const localeInfo = (code: string) => LOCALES.find((l) => l.code === code);
  return (
    <nav className="sr-only" aria-label="Languages">
      <ul>
        {MARKETING_LOCALES.map((code) => (
          <li key={code}>
            <a href={localizedHref(code, path)} hrefLang={code}>
              {localeInfo(code)?.label ?? code.toUpperCase()}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
