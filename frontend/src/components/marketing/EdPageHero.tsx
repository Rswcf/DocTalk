"use client";

import Link from "next/link";

interface EdPageHeroProps {
  eyebrow?: string;
  title: React.ReactNode;
  lede?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  icon?: React.ComponentType<{ className?: string }>;
  meta?: React.ReactNode;
}

export default function EdPageHero({
  eyebrow,
  title,
  lede,
  primaryCta,
  secondaryCta,
  icon: Icon,
  meta,
}: EdPageHeroProps) {
  const hasCta = !!(primaryCta || secondaryCta);

  return (
    <section className="pt-16 pb-14">
      <div className="ed-shell">
        <div style={{ maxWidth: "820px" }}>
          {Icon && (
            <div
              style={{
                width: "44px",
                height: "44px",
                border: "1px solid var(--ed-rule)",
                background: "var(--ed-paper-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "24px",
              }}
            >
              <span style={{ color: "var(--ed-ink-2)", display: "flex" }}>
                <Icon className="w-5 h-5" />
              </span>
            </div>
          )}
          {eyebrow && <div className="ed-label">{eyebrow}</div>}
          <h1
            className="ed-h1"
            style={eyebrow ? { marginTop: "8px" } : undefined}
          >
            {title}
          </h1>
          {lede && (
            <p
              className="ed-lede"
              style={{ marginTop: "18px", maxWidth: "620px" }}
            >
              {lede}
            </p>
          )}
          {meta && <div style={{ marginTop: "16px" }}>{meta}</div>}
          {hasCta && (
            <div
              className="flex items-center flex-wrap"
              style={{ marginTop: "28px", gap: "16px" }}
            >
              {primaryCta && (
                <Link href={primaryCta.href} className="ed-cta">
                  {primaryCta.label}
                </Link>
              )}
              {secondaryCta && (
                <Link href={secondaryCta.href} className="ed-link">
                  {secondaryCta.label} <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
