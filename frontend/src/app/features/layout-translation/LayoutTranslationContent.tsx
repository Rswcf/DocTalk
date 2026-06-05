import { getServerT } from '../../../i18n/server';
import { getChromeStrings } from '../../../i18n/chrome';
import LayoutTranslationPageContent from './LayoutTranslationPageContent';

export default async function LayoutTranslationContent({ locale }: { locale: string }) {
  const { t, tOr } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);

  return (
    <LayoutTranslationPageContent
      locale={locale}
      t={t}
      tOr={tOr}
      chrome={chrome}
      languageLabel={chrome.language}
    />
  );
}
