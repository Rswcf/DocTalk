"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import DocTalkLogo from "../DocTalkLogo";
import EdLanguageSelector from "./EdLanguageSelector";
import { useLocale } from "../../i18n";
import { localizedHrefIfAvailable, splitLocaleFromPath } from "../../i18n/routing";
import type { ChromeStrings } from "../../i18n/chrome";
import { trackEvent } from "../../lib/analytics";

export interface Crumb {
  label: string;
  href?: string;
}

export interface EditorialHeaderBaseProps {
  /** Breadcrumb row rendered below the masthead (inner-page variant). */
  breadcrumb?: Crumb[];
  /** Server-resolved strings for localized pages; falls back to `useLocale()`. */
  chrome?: ChromeStrings;
}

/**
 * Shared editorial masthead used by both:
 * - landing-page `EditorialHeader`
 * - inner-page `EditorialMarketingHeader` (passes `breadcrumb`)
 *
 * Carries the sticky bar (logo + wordmark + nav links + sign-in CTA),
 * the mobile hamburger button, and the mobile nav panel.
 */
export default function EditorialHeaderBase({
  breadcrumb,
  chrome,
}: EditorialHeaderBaseProps) {
  const { t, tOr } = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Derive the URL locale from the path so nav links stay in-language on
  // localized pages (`/de/...`). Targets not yet localized fall back to English.
  const pathname = usePathname() || "/";
  const { locale: urlLocale } = splitLocaleFromPath(pathname);
  const navHref = (path: string) => localizedHrefIfAvailable(urlLocale, path);
  // Prefer server-resolved chrome strings (correct language in initial HTML on
  // localized pages); otherwise the client-locale text.
  const labels = {
    features: chrome?.navFeatures ?? t("public.nav.features"),
    pricing: chrome?.navPricing ?? t("footer.pricing"),
    trust: chrome?.navTrust ?? tOr("footer.links.trust", "Security"),
    signIn: chrome?.signIn ?? t("auth.signIn"),
    trySample: chrome?.trySample ?? tOr("header.trySample", "Try a sample"),
  };
  // The masthead's one action (plan 2026-11-22-ui-ux-pangram-learnings, M3):
  // a quiet pill to the samples, on every marketing page but /demo itself.
  // Always quiet, never filled, so each page keeps its own single .ed-cta.
  const onDemoPage = pathname === "/demo" || /^\/[a-z]{2}\/demo$/.test(pathname);
  const NAV_LINKS = [
    { href: navHref("/features"), label: labels.features },
    { href: navHref("/pricing"), label: labels.pricing },
    { href: navHref("/trust"), label: labels.trust },
  ];

  return (
    <>
      <header
        className="sticky top-0 z-50 h-16 flex items-center ed-glass ed-glass--strong ed-glass--header"
      >
        <div className="ed-shell w-full">
          <div className="flex items-center justify-between h-16">
            {/* Left — logo + wordmark */}
            <Link
              href={navHref("/")}
              className="flex items-center gap-3 shrink-0"
              aria-label={t('header.aria.home')}
            >
              <DocTalkLogo size={24} />
              <span
                className="ed-masthead-wordmark"
                style={{
                  fontFamily: "var(--ed-display-family)",
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
              className="flex items-center gap-3 md:gap-6"
              aria-label={t('header.aria.nav')}
            >
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="hidden md:inline-block"
                  style={{
                    fontFamily: "var(--dt-body)",
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
              {/* Language selector: in the bar from md up; on phones it moves
                  into the menu so the bar holds only the logo, the masthead's
                  action and the menu button. */}
              <span className="hidden md:inline-flex">
                <EdLanguageSelector languageLabel={chrome?.language} />
              </span>
              <Link href="/auth" className="ed-masthead-link hidden md:inline-block">
                {labels.signIn}
              </Link>
              {!onDemoPage && (
                <Link
                  href={navHref("/demo")}
                  className="ed-cta-quiet ed-masthead-pill"
                  style={{ fontSize: "13px" }}
                  onClick={() => trackEvent("landing_cta_clicked", { source: "header", reason: "demo" })}
                >
                  {labels.trySample}
                </Link>
              )}
              {/* Mobile menu button, last in the bar on phones */}
              <button
                type="button"
                onClick={() => setMobileOpen((open) => !open)}
                className="md:hidden inline-flex items-center justify-center"
                style={{
                  width: "44px",
                  height: "44px",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
                aria-expanded={mobileOpen}
                aria-controls="ed-mobile-nav"
                aria-label={mobileOpen ? t('header.aria.closeMenu') : t('header.aria.openMenu')}
              >
                {mobileOpen ? (
                  <X aria-hidden="true" size={20} color="var(--ed-ink-2)" />
                ) : (
                  <Menu aria-hidden="true" size={20} color="var(--ed-ink-2)" />
                )}
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile nav panel — sits below the masthead, not sticky */}
      {mobileOpen && (
        <nav
          id="ed-mobile-nav"
          role="navigation"
          aria-label={t('header.aria.mobileNav')}
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
                fontSize: "16px",
                color: "var(--ed-ink-2)",
                textDecoration: "none",
                borderTop: idx === 0 ? "none" : "1px solid var(--ed-rule)",
              }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/auth"
            onClick={() => setMobileOpen(false)}
            className="block"
            style={{
              padding: "12px 24px",
              fontSize: "16px",
              color: "var(--ed-ink)",
              textDecoration: "none",
              borderTop: "1px solid var(--ed-rule)",
            }}
          >
            {labels.signIn}
          </Link>
          <div style={{ padding: "8px 16px 12px", borderTop: "1px solid var(--ed-rule)" }}>
            <EdLanguageSelector languageLabel={chrome?.language} />
          </div>
        </nav>
      )}

      {/* Breadcrumb row — not sticky, sits below the masthead */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav
          aria-label={t('header.aria.breadcrumb')}
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
