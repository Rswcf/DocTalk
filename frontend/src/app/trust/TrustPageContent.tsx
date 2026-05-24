
import React from "react";
import Link from "next/link";
import {
  Lock,
  ShieldCheck,
  FileWarning,
  KeyRound,
  UserX,
  Database,
  Globe2,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import MarketingShell from "../../components/marketing/MarketingShell";
import EdPageHero from "../../components/marketing/EdPageHero";
import EdSection from "../../components/marketing/EdSection";
import EdCtaBanner from "../../components/marketing/EdCtaBanner";
import { getServerT } from "../../i18n/server";
import { getChromeStrings } from "../../i18n/chrome";
import { localizedHrefIfAvailable } from "../../i18n/routing";
import MarketingLocaleLinks from "../../components/marketing/MarketingLocaleLinks";

/* Trust Center content is intentionally specific and hand-maintained here
 * because the technical claims (SSE-S3, SSRF, RFC 7748) need precise English
 * terminology to be credible. The copy now renders via i18n (namespace
 * `trust`), but the English source remains the canonical, audited wording.
 *
 * Honest rule for this page: everything listed is something we actually
 * implemented (see backend code + docs/ARCHITECTURE.md §10). Things we have
 * NOT done (SOC2, HIPAA, SSO) are listed openly in the "What we don't have
 * yet" section so the reader can judge the gap.
 */

interface Control {
  icon: LucideIcon;
  title: string;
  detail: string;
  evidence?: string;
}

function ControlCard({ icon: Icon, title, detail, evidence }: Control) {
  return (
    <div className="ed-card h-full" style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ color: "var(--ed-ink-3)", display: "flex", marginBottom: "12px" }}>
        <Icon aria-hidden size={18} />
      </span>
      <h3 className="ed-h3">{title}</h3>
      <p className="ed-body" style={{ marginTop: "8px" }}>
        {detail}
      </p>
      {evidence && (
        <p
          className="ed-caption"
          style={{
            marginTop: "auto",
            paddingTop: "12px",
            borderTop: "1px solid var(--ed-rule)",
          }}
        >
          {evidence}
        </p>
      )}
    </div>
  );
}

export default async function TrustPageContent({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (p: string) => localizedHrefIfAvailable(locale, p);

  const encryptionControls: Control[] = [
    {
      icon: Lock,
      title: t("trust.encryption.rest.title"),
      detail: t("trust.encryption.rest.detail"),
      evidence: t("trust.encryption.rest.evidence"),
    },
    {
      icon: KeyRound,
      title: t("trust.encryption.transit.title"),
      detail: t("trust.encryption.transit.detail"),
    },
    {
      icon: UserX,
      title: t("trust.encryption.noTraining.title"),
      detail: t("trust.encryption.noTraining.detail"),
    },
  ];

  const ingestControls: Control[] = [
    {
      icon: FileWarning,
      title: t("trust.ingest.magicByte.title"),
      detail: t("trust.ingest.magicByte.detail"),
      evidence: t("trust.ingest.magicByte.evidence"),
    },
    {
      icon: Globe2,
      title: t("trust.ingest.ssrf.title"),
      detail: t("trust.ingest.ssrf.detail"),
      evidence: t("trust.ingest.ssrf.evidence"),
    },
    {
      icon: AlertTriangle,
      title: t("trust.ingest.rateLimit.title"),
      detail: t("trust.ingest.rateLimit.detail"),
      evidence: t("trust.ingest.rateLimit.evidence"),
    },
  ];

  const dataRightsControls: Control[] = [
    {
      icon: Database,
      title: t("trust.dataRights.export.title"),
      detail: t("trust.dataRights.export.detail"),
    },
    {
      icon: UserX,
      title: t("trust.dataRights.deletion.title"),
      detail: t("trust.dataRights.deletion.detail"),
    },
    {
      icon: ShieldCheck,
      title: t("trust.dataRights.isolation.title"),
      detail: t("trust.dataRights.isolation.detail"),
    },
  ];

  const gaps = [
    {
      name: t("trust.gaps.soc2.name"),
      status: t("trust.gaps.soc2.status"),
      note: t("trust.gaps.soc2.note"),
    },
    {
      name: t("trust.gaps.hipaa.name"),
      status: t("trust.gaps.hipaa.status"),
      note: t("trust.gaps.hipaa.note"),
    },
    {
      name: t("trust.gaps.sso.name"),
      status: t("trust.gaps.sso.status"),
      note: t("trust.gaps.sso.note"),
    },
    {
      name: t("trust.gaps.onPrem.name"),
      status: t("trust.gaps.onPrem.status"),
      note: t("trust.gaps.onPrem.note"),
    },
  ];

  const trustStats = [
    { label: t("trust.stats.encryption.label"), value: t("trust.stats.encryption.value") },
    { label: t("trust.stats.transport.label"), value: t("trust.stats.transport.value") },
    { label: t("trust.stats.retention.label"), value: t("trust.stats.retention.value") },
  ];

  return (
    <MarketingShell
      chrome={chrome}
      breadcrumb={[
        { label: t("useCasesHub.breadcrumb.home"), href: href("/") },
        { label: t("trust.breadcrumb.current") },
      ]}
    >
      <EdPageHero
        eyebrow={t("trust.hero.eyebrow")}
        title={t("trust.hero.title")}
        lede={t("trust.hero.lede")}
        meta={
          <div className="flex gap-4 flex-wrap items-center">
            <Link href={href("/privacy")} className="ed-cta">
              {t("trust.hero.privacyCta")}
            </Link>
            <Link href={href("/contact")} className="ed-link">
              {t("trust.hero.reportCta")} <span aria-hidden="true">→</span>
            </Link>
          </div>
        }
      />

      <EdSection alt label={t("trust.summary.label")}>
        <div
          className="grid grid-cols-1 sm:grid-cols-3"
          style={{ gap: "16px" }}
        >
          {trustStats.map((stat) => (
            <div
              key={stat.label}
              style={{
                border: "1px solid var(--ed-rule)",
                background: "var(--ed-paper-2)",
                padding: "16px",
              }}
            >
              <div className="ed-h3">{stat.value}</div>
              <p className="ed-caption" style={{ marginTop: "6px" }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
        <p
          className="ed-caption"
          style={{
            marginTop: "20px",
            padding: "12px 14px",
            border: "1px solid var(--ed-rule)",
            color: "var(--ed-ochre)",
          }}
        >
          {t("trust.summary.disclaimer")}
        </p>
      </EdSection>

      <EdSection num="01" title={t("trust.encryption.heading")}>
        <div
          className="grid grid-cols-1 md:grid-cols-3"
          style={{ gap: "16px", gridAutoRows: "1fr" }}
        >
          {encryptionControls.map((c) => (
            <ControlCard key={c.title} {...c} />
          ))}
        </div>
      </EdSection>

      <EdSection alt num="02" title={t("trust.ingest.heading")}>
        <div
          className="grid grid-cols-1 md:grid-cols-3"
          style={{ gap: "16px", gridAutoRows: "1fr" }}
        >
          {ingestControls.map((c) => (
            <ControlCard key={c.title} {...c} />
          ))}
        </div>
      </EdSection>

      <EdSection num="03" title={t("trust.dataRights.heading")}>
        <div
          className="grid grid-cols-1 md:grid-cols-3"
          style={{ gap: "16px", gridAutoRows: "1fr" }}
        >
          {dataRightsControls.map((c) => (
            <ControlCard key={c.title} {...c} />
          ))}
        </div>
      </EdSection>

      <EdSection alt num="04" title={t("trust.gaps.heading")}>
        <div>
          {gaps.map((g, i) => (
            <div
              key={g.name}
              className="flex flex-col md:flex-row"
              style={{
                padding: "18px 0",
                borderTop: "1px solid var(--ed-rule)",
                borderBottom:
                  i === gaps.length - 1 ? "1px solid var(--ed-rule)" : undefined,
                gap: "12px",
              }}
            >
              <div className="md:w-64 shrink-0">
                <div className="ed-body" style={{ fontWeight: 600 }}>
                  {g.name}
                </div>
                <div
                  className="ed-caption"
                  style={{
                    marginTop: "6px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    textTransform: "uppercase",
                    color: "var(--ed-ochre)",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: "5px",
                      height: "5px",
                      background: "var(--ed-ochre)",
                    }}
                  />
                  {g.status}
                </div>
              </div>
              <p className="ed-body" style={{ flex: 1 }}>
                {g.note}
              </p>
            </div>
          ))}
        </div>
      </EdSection>

      <EdCtaBanner
        title={t("trust.cta.title")}
        description={t("trust.cta.description")}
        primary={{ label: t("trust.cta.primary"), href: href("/contact") }}
        secondary={{ label: t("trust.cta.secondary"), href: href("/privacy") }}
      />
    
      <MarketingLocaleLinks path="/trust" label={chrome.language} />
    </MarketingShell>
  );
}
