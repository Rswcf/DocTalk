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
  Mail,
  type LucideIcon,
} from "lucide-react";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
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
      "Public endpoints (shared views, anonymous reads) have per-IP rate limits with HMAC-signed IP trust chain via the Vercel edge — the real client IP cannot be spoofed. Authenticated users bypass.",
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

function ControlCard({ icon: Icon, title, detail, evidence }: Control) {
  return (
    <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="flex items-center gap-3 mb-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Icon aria-hidden size={18} />
        </span>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
        {detail}
      </p>
      {evidence && (
        <p className="mt-3 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
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
    <div className="flex flex-col min-h-screen bg-[var(--page-background)]">
      <Header variant="minimal" />
      <main id="main-content" className="flex-1">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-16 pb-10">
          <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-3">
            Trust Center
          </p>
          <h1 className="font-serif text-3xl md:text-5xl font-medium tracking-[-0.03em] text-zinc-900 dark:text-zinc-50 text-balance mb-5">
            The real controls protecting your documents.
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
            What DocTalk actually does to keep your uploads private, isolated,
            and unused for model training. And — openly — what we haven&apos;t
            certified yet.
          </p>
        </section>

        {/* Encryption & transit */}
        <section className="max-w-5xl mx-auto px-6 py-8">
          <h2 className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4">
            01 — Encryption & transit
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {encryptionControls.map((c) => (
              <ControlCard key={c.title} {...c} />
            ))}
          </div>
        </section>

        {/* Ingest safety */}
        <section className="max-w-5xl mx-auto px-6 py-8">
          <h2 className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4">
            02 — Ingest safety
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {ingestControls.map((c) => (
              <ControlCard key={c.title} {...c} />
            ))}
          </div>
        </section>

        {/* Data rights */}
        <section className="max-w-5xl mx-auto px-6 py-8">
          <h2 className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4">
            03 — Your data, your control
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {dataRightsControls.map((c) => (
              <ControlCard key={c.title} {...c} />
            ))}
          </div>
        </section>

        {/* Honest gaps */}
        <section className="max-w-5xl mx-auto px-6 py-8">
          <h2 className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4">
            04 — What we don&apos;t have yet
          </h2>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800">
            {gaps.map((g) => (
              <div key={g.name} className="flex flex-col md:flex-row md:items-start gap-2 md:gap-6 p-5">
                <div className="md:w-64 shrink-0">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {g.name}
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide text-amber-700 dark:text-amber-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                    {g.status}
                  </div>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {g.note}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="max-w-5xl mx-auto px-6 py-12">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                Report a security issue
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Responsible disclosure welcomed. We reply to every vulnerability
                report within 72 hours.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-semibold shadow-sm hover:shadow-md hover:bg-accent-hover transition-[box-shadow,background-color] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
              >
                <Mail aria-hidden size={14} />
                Contact security
              </Link>
              <Link
                href="/privacy"
                className="inline-flex items-center px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:border-accent hover:text-accent transition-colors motion-reduce:transition-none"
              >
                Privacy Policy
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
