"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DocTalkLogo from "../DocTalkLogo";
import { useLocale } from "../../i18n";
import { localizedHrefIfAvailable, splitLocaleFromPath } from "../../i18n/routing";
import type { ChromeStrings } from "../../i18n/chrome";

export default function EditorialFooter({ chrome }: { chrome?: ChromeStrings }) {
  const { t, tOr } = useLocale();
  // Keep footer links in-language on localized pages; targets not yet localized
  // resolve to their English URL (no 404s).
  const { locale: urlLocale } = splitLocaleFromPath(usePathname() || "/");
  const lh = (path: string) => localizedHrefIfAvailable(urlLocale, path);
  // Prefer server-resolved strings (correct language in initial HTML on
  // localized pages); otherwise client-locale text.
  const f = chrome?.footer;
  const L = {
    product: f?.product ?? t("footer.product"),
    useCases: f?.useCases ?? t("footer.useCases"),
    resources: f?.resources ?? t("footer.resources"),
    company: f?.company ?? t("footer.company"),
    demo: f?.demo ?? t("footer.demo"),
    pricing: f?.pricing ?? t("footer.pricing"),
    features: f?.features ?? t("footer.links.features"),
    noSignupDemo: f?.noSignupDemo ?? t("footer.links.noSignupDemo"),
    citationHighlighting: f?.citationHighlighting ?? t("footer.links.citationHighlighting"),
    performanceModes: f?.performanceModes ?? t("footer.links.performanceModes"),
    useCasesLink: f?.useCasesLink ?? t("footer.links.useCases"),
    students: f?.students ?? t("footer.links.students"),
    lawyers: f?.lawyers ?? t("footer.links.lawyers"),
    finance: f?.finance ?? t("footer.links.finance"),
    hrContracts: f?.hrContracts ?? t("footer.links.hrContracts"),
    compareTools: f?.compareTools ?? t("footer.links.compareTools"),
    alternatives: f?.alternatives ?? t("footer.links.alternatives"),
    blog: f?.blog ?? t("footer.links.blog"),
    comparisonGuides: f?.comparisonGuides ?? t("footer.links.comparisonGuides"),
    multiFormatSupport: f?.multiFormatSupport ?? t("footer.links.multiFormatSupport"),
    about: f?.about ?? t("footer.links.about"),
    contact: f?.contact ?? t("footer.contact"),
    trust: f?.trust ?? t("footer.links.trust"),
    imprint: f?.imprint ?? tOr("footer.imprint", "Imprint"),
    privacy: f?.privacy ?? t("privacy.policyLink"),
    terms: f?.terms ?? t("terms.title"),
    doNotSell: f?.doNotSell ?? t("footer.doNotSell"),
    tagline: f?.tagline ?? tOr("footer.tagline", "AI document intelligence. Cite exactly."),
  };

  const productLinks = [
    { href: lh("/demo"), label: L.demo },
    { href: lh("/pricing"), label: L.pricing },
    { href: lh("/features"), label: L.features },
    { href: lh("/features/free-demo"), label: L.noSignupDemo },
    { href: lh("/features/citations"), label: L.citationHighlighting },
    { href: lh("/features/performance-modes"), label: L.performanceModes },
  ];

  const useCaseLinks = [
    { href: lh("/use-cases"), label: L.useCasesLink },
    { href: lh("/use-cases/students"), label: L.students },
    { href: lh("/use-cases/lawyers"), label: L.lawyers },
    { href: lh("/use-cases/finance"), label: L.finance },
    { href: lh("/use-cases/hr-contracts"), label: L.hrContracts },
  ];

  const resourceLinks = [
    { href: lh("/compare"), label: L.compareTools },
    { href: lh("/alternatives"), label: L.alternatives },
    { href: lh("/blog"), label: L.blog },
    { href: lh("/blog/category/comparisons"), label: L.comparisonGuides },
    { href: lh("/features/multi-format"), label: L.multiFormatSupport },
  ];

  const companyLinks = [
    { href: lh("/about"), label: L.about },
    { href: lh("/contact"), label: L.contact },
    { href: lh("/trust"), label: L.trust },
    { href: lh("/imprint"), label: L.imprint },
  ];

  const legalLinks = [
    { href: lh("/privacy"), label: L.privacy },
    { href: lh("/terms"), label: L.terms },
    { href: lh("/privacy#ccpa"), label: L.doNotSell },
  ];

  const linkStyle: React.CSSProperties = {
    fontFamily: "var(--dt-body)",
    fontSize: "13px",
    color: "var(--ed-ink-2)",
    textDecoration: "none",
    lineHeight: 1.5,
    transition: "color 150ms ease",
  };

  function FooterLinkGroup({
    heading,
    links,
  }: {
    heading: string;
    links: { href: string; label: string }[];
  }) {
    return (
      <div>
        <div className="ed-label mb-4">{heading}</div>
        <ul className="space-y-3">
          {links.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                style={linkStyle}
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
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <footer
      style={{
        background: "var(--ed-paper)",
        borderTop: "1px solid var(--ed-rule)",
      }}
    >
      <div className="ed-shell py-16">
        {/* Top area — brand + link columns */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-8">
          {/* Brand column */}
          <div className="md:col-span-1">
            <Link
              href={lh("/")}
              className="inline-flex items-center gap-2.5 mb-4"
              style={{ textDecoration: "none" }}
              aria-label="DocTalk home"
            >
              <DocTalkLogo size={22} />
              <span
                style={{
                  fontFamily: "var(--dt-serif)",
                  fontSize: "18px",
                  fontWeight: 500,
                  color: "var(--ed-ink)",
                  lineHeight: 1,
                }}
              >
                DocTalk
              </span>
            </Link>
            <p className="ed-caption" style={{ maxWidth: "180px", lineHeight: 1.6 }}>
              {L.tagline}
            </p>
          </div>

          {/* Link columns */}
          <div className="md:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-8">
            <FooterLinkGroup heading={L.product} links={productLinks} />
            <FooterLinkGroup heading={L.useCases} links={useCaseLinks} />
            <FooterLinkGroup heading={L.resources} links={resourceLinks} />
            <FooterLinkGroup heading={L.company} links={companyLinks} />
          </div>
        </div>

        {/* Bottom fine-print row */}
        <hr className="ed-rule mt-10 mb-6" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <span className="ed-caption">
            &copy; MMXXVI DocTalk
          </span>
          <div className="flex items-center gap-5 flex-wrap">
            {legalLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="ed-caption"
                style={{
                  textDecoration: "none",
                  transition: "color 150ms ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.color =
                    "var(--ed-signal)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.color =
                    "var(--ed-ink-3)";
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
