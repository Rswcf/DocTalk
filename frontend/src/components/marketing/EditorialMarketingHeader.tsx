"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import DocTalkLogo from "../DocTalkLogo";
import { useLocale } from "../../i18n";

export interface Crumb {
  label: string;
  href?: string;
}

interface EditorialMarketingHeaderProps {
  breadcrumb?: Crumb[];
}

export default function EditorialMarketingHeader({
  breadcrumb,
}: EditorialMarketingHeaderProps) {
  const { t, tOr } = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  const NAV_LINKS = [
    { href: "/features", label: t("public.nav.features") },
    { href: "/pricing", label: t("footer.pricing") },
    { href: "/trust", label: tOr("footer.links.trust", "Security") },
  ];

  return (
    <>
      <header
        className="sticky top-0 z-50 h-16 flex items-center"
        style={{
          background: "var(--ed-paper)",
          borderBottom: "1px solid var(--ed-rule)",
        }}
      >
        <div className="ed-shell w-full">
          <div className="flex items-center justify-between h-16">
            {/* Left — logo + wordmark only (no dateline block) */}
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
              {/* Mobile hamburger — sits left of the Sign-In CTA, md:hidden */}
              <button
                type="button"
                onClick={() => setMobileOpen((open) => !open)}
                className="md:hidden inline-flex items-center justify-center"
                style={{
                  width: "36px",
                  height: "36px",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
                aria-expanded={mobileOpen}
                aria-controls="ed-mobile-nav"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
              >
                {mobileOpen ? (
                  <X aria-hidden="true" size={20} color="var(--ed-ink-2)" />
                ) : (
                  <Menu aria-hidden="true" size={20} color="var(--ed-ink-2)" />
                )}
              </button>
              <Link
                href="/auth"
                className="ed-cta"
                style={{ padding: "9px 18px", fontSize: "13px" }}
              >
                {t("auth.signIn")}
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile nav panel — sits below the masthead, not sticky */}
      {mobileOpen && (
        <nav
          id="ed-mobile-nav"
          role="navigation"
          aria-label="Editorial mobile navigation"
          className="md:hidden"
          style={{
            background: "var(--ed-paper)",
            borderBottom: "1px solid var(--ed-rule)",
          }}
        >
          {NAV_LINKS.map((item, idx) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="block"
              style={{
                padding: "12px 24px",
                fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.10em",
                color: "var(--ed-ink-2)",
                textDecoration: "none",
                borderTop:
                  idx === 0 ? "none" : "1px solid var(--ed-rule)",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}

      {/* Breadcrumb row — not sticky, sits below the masthead */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          style={{ borderBottom: "1px solid var(--ed-rule)" }}
        >
          <div className="ed-shell">
            <ol
              className="flex items-center gap-2"
              style={{ listStyle: "none", margin: 0, padding: "12px 0" }}
            >
              {breadcrumb.map((crumb, index) => {
                const isLast = index === breadcrumb.length - 1;
                return (
                  <li key={crumb.label} className="flex items-center gap-2">
                    {index > 0 && (
                      <span className="ed-caption" aria-hidden="true">
                        /
                      </span>
                    )}
                    {crumb.href && !isLast ? (
                      <Link href={crumb.href} className="ed-crumb">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span
                        className="ed-crumb"
                        style={{ color: "var(--ed-ink)" }}
                        aria-current="page"
                      >
                        {crumb.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </nav>
      )}
    </>
  );
}
