"use client";

import { useLocale } from '../../i18n';
import MarketingShell from '../../components/marketing/MarketingShell';
import EdPageHero from '../../components/marketing/EdPageHero';
import EdSection from '../../components/marketing/EdSection';
import EdProse from '../../components/marketing/EdProse';
import EdCheckList from '../../components/marketing/EdCheckList';
import EdCtaBanner from '../../components/marketing/EdCtaBanner';

export default function AboutPageClient() {
  const { t } = useLocale();

  return (
    <MarketingShell
      breadcrumb={[
        { label: t('useCasesHub.breadcrumb.home'), href: '/' },
        { label: t('about.eyebrow') },
      ]}
    >
      <EdPageHero
        eyebrow={t('about.eyebrow')}
        title={t('about.headline')}
        lede={t('about.description')}
      />

      <EdSection alt num="01" title={t('about.optimizeFor.title')}>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '40px' }}>
          <EdCheckList
            items={[
              t('about.optimizeFor.item1'),
              t('about.optimizeFor.item2'),
              t('about.optimizeFor.item3'),
              t('about.optimizeFor.item4'),
            ]}
          />
          <div>
            <h3 className="ed-h3" style={{ marginBottom: '14px' }}>
              {t('about.whoUses.title')}
            </h3>
            <EdCheckList
              items={[
                t('about.whoUses.item1'),
                t('about.whoUses.item2'),
                t('about.whoUses.item3'),
                t('about.whoUses.item4'),
              ]}
            />
          </div>
        </div>
      </EdSection>

      <EdSection num="02" title={t('about.trust.title')}>
        <EdProse>
          <p>{t('about.trust.paragraph1')}</p>
          <p>{t('about.trust.paragraph2')}</p>
        </EdProse>
      </EdSection>

      <EdSection alt num="03" title={t('about.howItWorks.title')}>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '16px', gridAutoRows: '1fr' }}>
          <div className="ed-card h-full">
            <h3 className="ed-h3">{t('about.howItWorks.title')}</h3>
            <p className="ed-body" style={{ marginTop: '8px' }}>
              {t('about.howItWorks.description')}
            </p>
          </div>
          <div className="ed-card h-full">
            <h3 className="ed-h3">{t('about.whatWePublish.title')}</h3>
            <p className="ed-body" style={{ marginTop: '8px' }}>
              {t('about.whatWePublish.description')}
            </p>
          </div>
        </div>
      </EdSection>

      <EdSection num="04" title={t('about.contact.title')}>
        <EdProse>
          <p>
            {t('about.contact.description1')}{' '}
            <a href="mailto:support@doctalk.site">support@doctalk.site</a>
            {t('about.contact.description2')}{' '}
            <a
              href="https://github.com/Rswcf/DocTalk"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            .
          </p>
          <p style={{ color: 'var(--ed-ink-3)' }}>
            {t('about.contact.evaluationHint')}
          </p>
        </EdProse>
      </EdSection>

      <EdCtaBanner
        title={t('about.headline')}
        primary={{ label: t('useCasesHub.breadcrumb.home'), href: '/' }}
        secondary={{ label: t('privacy.policyLink'), href: '/privacy' }}
      />
    </MarketingShell>
  );
}
