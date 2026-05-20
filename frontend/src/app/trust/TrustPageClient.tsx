"use client";

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
import { usePageTitle } from "../../lib/usePageTitle";
import { useLocale } from "../../i18n";

/* Trust Center content is intentionally specific and hand-maintained here
 * rather than i18n'd, because the technical claims (SSE-S3, SSRF, RFC 7748)
 * need precise English terminology to be credible. Copy will translate at
 * the section-heading level; the control names stay in English.
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

const encryptionControls: Control[] = [
  {
    icon: Lock,
    title: "AES-256 encryption at rest",
    detail:
      "Uploaded documents are written to MinIO with SSE-S3 server-side encryption by default. Production (Railway) runs MinIO with KMS enabled so SSE-S3 is always applied. In unsupported self-hosted deployments without KMS, MinIO may fall back to unencrypted writes — that is a deployment choice, not a silent downgrade in production.",
    evidence: "backend/app/services/storage_service.py · upload_file()",
  },
  {
    icon: KeyRound,
    title: "TLS 1.2+ in transit",
    detail:
      "Every network hop — browser to Vercel edge, edge to Railway backend, backend to LLM providers — uses TLS. HSTS with max-age=63072000 and includeSubDomains is set on the apex domain.",
  },
  {
    icon: UserX,
    title: "No training on your data",
    detail:
      "DocTalk routes LLM calls through OpenRouter. Your documents and questions are never used by DocTalk to train models. Provider-side retention depends on the upstream model (DeepSeek / Mistral) — for guaranteed zero retention we rely on OpenRouter's account-level privacy setting (operational control, not yet code-enforced at the request level), and can tighten further with a provider allow-list on request.",
  },
];

const ingestControls: Control[] = [
  {
    icon: FileWarning,
    title: "Magic-byte file validation",
    detail:
      "Uploads are validated against file signature bytes, not file extensions. A .pdf with an executable payload inside is rejected at ingest — you cannot trick the parser by renaming a file.",
    evidence: "backend/app/services/upload_service.py · magic-byte check",
  },
  {
    icon: Globe2,
    title: "SSRF protection on URL ingestion",
    detail:
      "When you drop a URL to summarize, the backend validates the target against an allow-list of public hosts and rejects any request to private IP ranges, link-local addresses, or cloud metadata endpoints (169.254.169.254, etc).",
    evidence: "backend/app/core/url_validator.py",
  },
  {
    icon: AlertTriangle,
    title: "Rate limits on anonymous endpoints",
    detail:
      "Public endpoints (shared views, anonymous reads) have per-IP rate limits. The real client IP is forwarded from the Vercel edge to our backend with an HMAC-SHA256 signature bound to a per-request timestamp, so the backend can authenticate the proxy origin and reject header-spoofing attempts. This is not a defense against an active wire-level MITM — TLS handles that layer. Authenticated users bypass IP rate limiting.",
    evidence: "backend/app/core/rate_limit.py · shared_view_limiter, anon_read_limiter",
  },
];

const dataRightsControls: Control[] = [
  {
    icon: Database,
    title: "Full data export",
    detail:
      "From your Profile → Account you can export all your documents and session data. The export includes everything DocTalk stores about you, in portable formats.",
  },
  {
    icon: UserX,
    title: "Account deletion",
    detail:
      "You can delete your account from Profile → Account. All documents, sessions, chat history, embeddings, and billing records are removed; the account is not recoverable after deletion.",
  },
  {
    icon: ShieldCheck,
    title: "User isolation",
    detail:
      "Every document and session is scoped to its owner's user_id at the database and vector-store layer. There is no shared namespace, no org-wide collection by default, and the isolation is enforced at query time — not just at render time.",
  },
];

const gaps = [
  {
    name: "SOC 2 Type II",
    status: "Not audited",
    note: "We are a small team without the engineering spend for a full SOC 2 audit yet. The underlying controls are in place; the certification is not.",
  },
  {
    name: "HIPAA",
    status: "Not compliant",
    note: "DocTalk is not a HIPAA-covered business associate. If you handle Protected Health Information, do not upload PHI until we announce BAA support.",
  },
  {
    name: "Enterprise SSO / SAML",
    status: "Not available",
    note: "Individual OAuth (Google, Microsoft) and magic-link email sign-in only. Enterprise SSO is on the roadmap but not shipped.",
  },
  {
    name: "On-premise / air-gapped deployment",
    status: "Not offered",
    note: "DocTalk is SaaS only. Self-hosted is not currently supported.",
  },
];

const trustStats = [
  { label: "Encryption", value: "AES-256" },
  { label: "Transport", value: "TLS 1.2+" },
  { label: "Retention stance", value: "No training" },
];

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

export default function TrustPageClient() {
  const { t } = useLocale();
  usePageTitle(t("trust.title", {}) || "Trust & Security");

  return (
    <MarketingShell
      breadcrumb={[
        { label: t("useCasesHub.breadcrumb.home"), href: "/" },
        { label: "Trust & Security" },
      ]}
    >
      <EdPageHero
        eyebrow="Trust Center"
        title="The real controls protecting your documents."
        lede="What DocTalk actually does to keep your uploads private, isolated, and unused for model training. And openly, what we haven't certified yet."
        meta={
          <div className="flex gap-4 flex-wrap items-center">
            <Link href="/privacy" className="ed-cta">
              Privacy policy
            </Link>
            <Link href="/contact" className="ed-link">
              Report security issue <span aria-hidden="true">→</span>
            </Link>
          </div>
        }
      />

      <EdSection alt label="Control summary">
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
          Compliance badges are not claimed unless they are actually audited.
        </p>
      </EdSection>

      <EdSection num="01" title="Encryption & transit">
        <div
          className="grid grid-cols-1 md:grid-cols-3"
          style={{ gap: "16px", gridAutoRows: "1fr" }}
        >
          {encryptionControls.map((c) => (
            <ControlCard key={c.title} {...c} />
          ))}
        </div>
      </EdSection>

      <EdSection alt num="02" title="Ingest safety">
        <div
          className="grid grid-cols-1 md:grid-cols-3"
          style={{ gap: "16px", gridAutoRows: "1fr" }}
        >
          {ingestControls.map((c) => (
            <ControlCard key={c.title} {...c} />
          ))}
        </div>
      </EdSection>

      <EdSection num="03" title="Your data, your control">
        <div
          className="grid grid-cols-1 md:grid-cols-3"
          style={{ gap: "16px", gridAutoRows: "1fr" }}
        >
          {dataRightsControls.map((c) => (
            <ControlCard key={c.title} {...c} />
          ))}
        </div>
      </EdSection>

      <EdSection alt num="04" title="What we don't have yet">
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
        title="Report a security issue"
        description="Responsible disclosure welcomed. We reply to every vulnerability report within 72 hours."
        primary={{ label: "Contact security", href: "/contact" }}
        secondary={{ label: "Privacy Policy", href: "/privacy" }}
      />
    </MarketingShell>
  );
}
