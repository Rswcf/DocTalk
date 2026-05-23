"use client";

import Link from 'next/link';
import { useLocale } from '../../i18n';
import { usePageTitle } from '../../lib/usePageTitle';
import MarketingShell from '../../components/marketing/MarketingShell';
import EdPageHero from '../../components/marketing/EdPageHero';
import EdSection from '../../components/marketing/EdSection';
import EdProse from '../../components/marketing/EdProse';

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

const LINK_STYLE: React.CSSProperties = {
  color: 'var(--ed-signal)',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
};

export default function ImprintPageClient() {
  const { t, tOr, locale } = useLocale();
  usePageTitle(tOr('imprint.title', 'Impressum'));
  const isGerman = locale === 'de';

  return (
    <MarketingShell
      breadcrumb={[
        { label: t('useCasesHub.breadcrumb.home'), href: '/' },
        { label: tOr('imprint.title', 'Impressum') },
      ]}
    >
      <EdPageHero
        eyebrow={tOr('imprint.title', 'Impressum')}
        title={tOr('imprint.title', 'Impressum')}
        lede={tOr(
          'imprint.subtitle',
          'Legal disclosure pursuant to § 5 DDG (German Digital Services Act)'
        )}
        meta={
          <p className="ed-caption">
            {tOr('imprint.lastUpdated', 'Zuletzt aktualisiert / Last updated')}: 2026-04-14
          </p>
        }
      />

      <EdSection
        alt
        num="01"
        title={tOr('imprint.operator.title', 'Angaben gemäß § 5 DDG / Information pursuant to § 5 DDG')}
      >
        <div className="ed-card" style={{ maxWidth: '480px' }}>
          <address className="not-italic ed-body" style={{ lineHeight: 1.8 }}>
            <strong style={{ color: 'var(--ed-ink)' }}>{LEGAL_NAME}</strong>
            <br />
            {BUSINESS_ADDRESS_LINE1}
            <br />
            {BUSINESS_POSTAL_CODE} {BUSINESS_CITY}
            <br />
            {BUSINESS_COUNTRY}
          </address>
          <p className="ed-caption" style={{ marginTop: '12px' }}>
            {tOr(
              'imprint.operator.form',
              'Einzelunternehmen / Sole proprietorship (natural person under German law)'
            )}
          </p>
        </div>
      </EdSection>

      <EdSection num="02" title={tOr('imprint.contact.title', 'Kontakt / Contact')}>
        <EdProse>
          <p>
            {tOr('imprint.contact.emailLabel', 'E-Mail')}:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={LINK_STYLE}>
              {CONTACT_EMAIL}
            </a>
            <br />
            {tOr('imprint.contact.formLabel', 'Kontaktformular / Contact form')}:{' '}
            <Link href={CONTACT_FORM_PATH} style={LINK_STYLE}>
              www.doctalk.site{CONTACT_FORM_PATH}
            </Link>
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt num="03" title={tOr('imprint.vat.title', 'Umsatzsteuer-ID / VAT ID')}>
        <EdProse>
          <p>
            {tOr(
              'imprint.vat.body',
              'Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG: {status}',
              { status: isGerman ? VAT_ID_STATUS_DE : VAT_ID_STATUS_EN }
            )}
          </p>
        </EdProse>
      </EdSection>

      <EdSection
        num="04"
        title={tOr(
          'imprint.editor.title',
          'Redaktionell verantwortlich / Person responsible for content'
        )}
      >
        <EdProse>
          <p>
            {tOr(
              'imprint.editor.body',
              '{name} (Anschrift wie oben / address as above)',
              { name: LEGAL_NAME }
            )}
          </p>
          <p style={{ color: 'var(--ed-ink-3)' }}>
            {tOr(
              'imprint.editor.note',
              'Pursuant to § 18 Abs. 2 MStV (German Media State Treaty).'
            )}
          </p>
        </EdProse>
      </EdSection>

      <EdSection
        alt
        num="05"
        title={tOr('imprint.odr.title', 'EU-Streitschlichtung / EU Dispute Resolution')}
      >
        <EdProse>
          <p>
            {tOr(
              'imprint.odr.body',
              'Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit. / The European Commission provides a platform for online dispute resolution (ODR):'
            )}
            <br />
            <a
              href="https://ec.europa.eu/consumers/odr/"
              target="_blank"
              rel="noopener noreferrer"
              style={LINK_STYLE}
            >
              https://ec.europa.eu/consumers/odr/
            </a>
          </p>
        </EdProse>
      </EdSection>

      <EdSection
        num="06"
        title={tOr(
          'imprint.consumer.title',
          'Verbraucherstreitbeilegung / Consumer Dispute Resolution'
        )}
      >
        <EdProse>
          <p>
            {tOr(
              'imprint.consumer.body',
              'Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. / We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration body.'
            )}
          </p>
        </EdProse>
      </EdSection>

      <EdSection
        alt
        num="07"
        title={tOr('imprint.liability.title', 'Haftung für Inhalte / Liability for Content')}
      >
        <EdProse>
          <p>
            {tOr(
              'imprint.liability.body',
              'Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen. / As a service provider, we are responsible for our own content on these pages according to general laws. However, under §§ 8–10 DDG we are not obliged to monitor transmitted or stored third-party information.'
            )}
          </p>
        </EdProse>
      </EdSection>
    </MarketingShell>
  );
}
