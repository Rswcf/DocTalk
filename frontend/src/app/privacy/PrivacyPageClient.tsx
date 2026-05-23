"use client";

import { useLocale } from '../../i18n';
import { usePageTitle } from '../../lib/usePageTitle';
import MarketingShell from '../../components/marketing/MarketingShell';
import EdPageHero from '../../components/marketing/EdPageHero';
import EdSection from '../../components/marketing/EdSection';
import EdProse from '../../components/marketing/EdProse';

export default function PrivacyPageClient() {
  const { t, tOr } = useLocale();
  usePageTitle(t('privacy.title'));

  return (
    <MarketingShell
      breadcrumb={[
        { label: t('useCasesHub.breadcrumb.home'), href: '/' },
        { label: t('privacy.title') },
      ]}
    >
      <EdPageHero
        eyebrow={t('privacy.title')}
        title={t('privacy.title')}
        lede={tOr('privacy.controller.intro', 'The controller responsible for the processing of personal data on this website is:')}
        meta={
          <p className="ed-caption">
            {t('privacy.lastUpdated')}: 2026-02-05
          </p>
        }
      />

      <EdSection alt title={tOr('privacy.controller.title', 'Data Controller (GDPR Art. 4(7))')}>
        <div
          className="ed-card"
          style={{ maxWidth: '480px' }}
        >
          <address className="not-italic ed-body" style={{ lineHeight: 1.8 }}>
            <strong style={{ color: 'var(--ed-ink)' }}>Yijie Ma</strong>
            <br />
            [BUSINESS_ADDRESS_LINE1]
            <br />
            [PLZ] [CITY]
            <br />
            Germany
            <br />
            <a href="mailto:privacy@doctalk.site" style={{ color: 'var(--ed-signal)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
              privacy@doctalk.site
            </a>
          </address>
        </div>
      </EdSection>

      <EdSection num="01" title={t('privacy.section1.title')}>
        <EdProse>
          <p>{t('privacy.section1.content')}</p>
        </EdProse>
      </EdSection>

      <EdSection alt num="02" title={t('privacy.section2.title')}>
        <EdProse>
          <ul>
            <li>{t('privacy.section2.item1')}</li>
            <li>{t('privacy.section2.item2')}</li>
            <li>{t('privacy.section2.item3')}</li>
          </ul>
        </EdProse>
      </EdSection>

      <EdSection num="03" title={t('privacy.section3.title')}>
        <EdProse>
          <p>{t('privacy.section3.content')}</p>
        </EdProse>
      </EdSection>

      <EdSection alt num="04" title={t('privacy.section4.title')}>
        <EdProse>
          <p>{t('privacy.section4.content')}</p>
        </EdProse>
      </EdSection>

      <EdSection num="05" title={t('privacy.section5.title')}>
        <EdProse>
          <p>{t('privacy.section5.content')}</p>
        </EdProse>
      </EdSection>

      <EdSection alt id="ccpa" num="06" title={t('privacy.ccpa.title')}>
        <EdProse>
          <p>{t('privacy.ccpa.content')}</p>
        </EdProse>
      </EdSection>
    </MarketingShell>
  );
}
