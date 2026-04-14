"use client";

import Link from 'next/link';
import { useLocale } from '../../i18n';
import { usePageTitle } from '../../lib/usePageTitle';

// Legally-binding Impressum fields. These values are identical across every
// locale because §5 DDG expects the operator's real identity and contact
// details verbatim — translating "Yijie Ma" or the street name would defeat
// the purpose (Zustellbarkeit). Labels go through i18n; the data does not.
const LEGAL_NAME = 'Yijie Ma';
const BUSINESS_ADDRESS_LINE1 = '[BUSINESS_ADDRESS_LINE1]';
const BUSINESS_POSTAL_CODE = '[PLZ]';
const BUSINESS_CITY = '[CITY]';
const BUSINESS_COUNTRY = 'Germany';
const CONTACT_EMAIL = 'support@doctalk.site';
const CONTACT_FORM_PATH = '/contact';
const VAT_ID_STATUS_DE = 'wird nach erfolgter Registrierung beim Finanzamt ergänzt';
const VAT_ID_STATUS_EN = 'will be added after registration with the Finanzamt';

export default function ImprintPageClient() {
  const { t, tOr, locale } = useLocale();
  usePageTitle(tOr('imprint.title', 'Impressum'));
  const isGerman = locale === 'de';

  return (
    <main id="main-content" className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-800 rounded-xl p-8 shadow-sm">
        <h1 className="text-2xl font-semibold mb-2 dark:text-white">
          {tOr('imprint.title', 'Impressum')}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-300 mb-8">
          {tOr(
            'imprint.subtitle',
            'Legal disclosure pursuant to § 5 DDG (German Digital Services Act)'
          )}
        </p>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-zinc-700 dark:text-zinc-300">
          <section>
            <h2 className="text-lg font-semibold mb-2 dark:text-white">
              {tOr('imprint.operator.title', 'Angaben gemäß § 5 DDG / Information pursuant to § 5 DDG')}
            </h2>
            <address className="not-italic leading-7">
              <strong className="text-zinc-900 dark:text-zinc-100">{LEGAL_NAME}</strong><br />
              {BUSINESS_ADDRESS_LINE1}<br />
              {BUSINESS_POSTAL_CODE} {BUSINESS_CITY}<br />
              {BUSINESS_COUNTRY}
            </address>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {tOr(
                'imprint.operator.form',
                'Einzelunternehmen / Sole proprietorship (natural person under German law)'
              )}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 dark:text-white">
              {tOr('imprint.contact.title', 'Kontakt / Contact')}
            </h2>
            <p className="leading-7">
              {tOr('imprint.contact.emailLabel', 'E-Mail')}:{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              <br />
              {tOr('imprint.contact.formLabel', 'Kontaktformular / Contact form')}:{' '}
              <Link
                href={CONTACT_FORM_PATH}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                www.doctalk.site{CONTACT_FORM_PATH}
              </Link>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 dark:text-white">
              {tOr('imprint.vat.title', 'Umsatzsteuer-ID / VAT ID')}
            </h2>
            <p className="leading-7">
              {tOr(
                'imprint.vat.body',
                'Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG: {status}',
                { status: isGerman ? VAT_ID_STATUS_DE : VAT_ID_STATUS_EN }
              )}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 dark:text-white">
              {tOr(
                'imprint.editor.title',
                'Redaktionell verantwortlich / Person responsible for content'
              )}
            </h2>
            <p className="leading-7">
              {tOr(
                'imprint.editor.body',
                '{name} (Anschrift wie oben / address as above)',
                { name: LEGAL_NAME }
              )}
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {tOr(
                'imprint.editor.note',
                'Pursuant to § 18 Abs. 2 MStV (German Media State Treaty).'
              )}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 dark:text-white">
              {tOr('imprint.odr.title', 'EU-Streitschlichtung / EU Dispute Resolution')}
            </h2>
            <p className="leading-7">
              {tOr(
                'imprint.odr.body',
                'Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit. / The European Commission provides a platform for online dispute resolution (ODR):'
              )}
              <br />
              <a
                href="https://ec.europa.eu/consumers/odr/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                https://ec.europa.eu/consumers/odr/
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 dark:text-white">
              {tOr(
                'imprint.consumer.title',
                'Verbraucherstreitbeilegung / Consumer Dispute Resolution'
              )}
            </h2>
            <p className="leading-7">
              {tOr(
                'imprint.consumer.body',
                'Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. / We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration body.'
              )}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 dark:text-white">
              {tOr('imprint.liability.title', 'Haftung für Inhalte / Liability for Content')}
            </h2>
            <p className="leading-7">
              {tOr(
                'imprint.liability.body',
                'Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen. / As a service provider, we are responsible for our own content on these pages according to general laws. However, under §§ 8–10 DDG we are not obliged to monitor transmitted or stored third-party information.'
              )}
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t dark:border-zinc-700 text-sm text-zinc-500">
          <p>
            {tOr('imprint.lastUpdated', 'Zuletzt aktualisiert / Last updated')}: 2026-04-14
          </p>
        </div>

        <Link
          href="/"
          className="inline-block mt-6 text-zinc-600 hover:underline focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
        >
          ← {t('common.backToHome')}
        </Link>
      </div>
    </main>
  );
}
