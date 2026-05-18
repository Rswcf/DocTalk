"use client";

import Link from "next/link";
import DocTalkLogo from "../DocTalkLogo";
import { useLocale } from "../../i18n";

export default function EditorialHeader() {
  const { t, tOr } = useLocale();
  const NAV_LINKS = [
    { href: "/features", label: t("public.nav.features") },
    { href: "/pricing", label: t("footer.pricing") },
    { href: "/trust", label: tOr("footer.links.trust", "Security") },
  ];

  return (
    <header
      className="sticky top-0 z-50 h-16 flex items-center"
      style={{
        background: "var(--ed-paper)",
        borderBottom: "1px solid var(--ed-rule)",
      }}
    >
      <div className="ed-shell w-full">
        <div className="flex items-center justify-between h-16">
          {/* Left — logo + wordmark + descriptor */}
          <Link
            href="/"
            className="flex items-center gap-3 shrink-0"
            aria-label="DocTalk home"
          >
            <DocTalkLogo size={24} />
            <span
              style={{
                fontFamily: "var(--font-newsreader), Georgia, serif",
                fontSize: "19px",
                fontWeight: 500,
                color: "var(--ed-ink)",
                lineHeight: 1,
              }}
            >
              DocTalk
            </span>
            {/* Thin vertical hairline separator */}
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: "1px",
                height: "28px",
                background: "var(--ed-rule)",
                marginLeft: "4px",
                marginRight: "8px",
              }}
            />
            {/* Editorial dateline block — two mono lines */}
            <span
              className="hidden sm:flex"
              style={{ flexDirection: "column", gap: "2px" }}
            >
              <span className="ed-caption" style={{ letterSpacing: "0.10em" }}>
                STUDIO N&ordm;&thinsp;01
              </span>
              <span className="ed-caption" style={{ letterSpacing: "0.08em" }}>
                DOCUMENT INTELLIGENCE
              </span>
            </span>
          </Link>

          {/* Right — nav links + CTA */}
          <nav
            className="flex items-center gap-6"
            aria-label="Editorial navigation"
          >
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hidden md:inline-block"
                style={{
                  fontFamily: "var(--font-inter), system-ui, sans-serif",
                  fontSize: "13px",
                  color: "var(--ed-ink-2)",
                  textDecoration: "none",
                  transition: "color 150ms ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.color =
                    "var(--ed-signal)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.color =
                    "var(--ed-ink-2)";
                }}
              >
                {item.label}
              </Link>
            ))}
            <Link href="/auth" className="ed-cta" style={{ padding: "9px 18px", fontSize: "13px" }}>
              {t("auth.signIn")}
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
