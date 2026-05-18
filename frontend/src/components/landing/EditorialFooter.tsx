"use client";

import Link from "next/link";
import DocTalkLogo from "../DocTalkLogo";
import { useLocale } from "../../i18n";

export default function EditorialFooter() {
  const { t, tOr } = useLocale();

  const productLinks = [
    { href: "/demo", label: t("footer.demo") },
    { href: "/pricing", label: t("footer.pricing") },
    { href: "/features", label: t("footer.links.features") },
    { href: "/features/free-demo", label: t("footer.links.noSignupDemo") },
    { href: "/features/citations", label: t("footer.links.citationHighlighting") },
    { href: "/features/performance-modes", label: t("footer.links.performanceModes") },
  ];

  const useCaseLinks = [
    { href: "/use-cases", label: t("footer.links.useCases") },
    { href: "/use-cases/students", label: t("footer.links.students") },
    { href: "/use-cases/lawyers", label: t("footer.links.lawyers") },
    { href: "/use-cases/finance", label: t("footer.links.finance") },
    { href: "/use-cases/hr-contracts", label: t("footer.links.hrContracts") },
  ];

  const resourceLinks = [
    { href: "/compare", label: t("footer.links.compareTools") },
    { href: "/alternatives", label: t("footer.links.alternatives") },
    { href: "/blog", label: t("footer.links.blog") },
    { href: "/blog/category/comparisons", label: t("footer.links.comparisonGuides") },
    { href: "/features/multi-format", label: t("footer.links.multiFormatSupport") },
  ];

  const companyLinks = [
    { href: "/about", label: t("footer.links.about") },
    { href: "/contact", label: t("footer.contact") },
    { href: "/trust", label: t("footer.links.trust") },
    { href: "/imprint", label: tOr("footer.imprint", "Imprint") },
  ];

  const legalLinks = [
    { href: "/privacy", label: t("privacy.policyLink") },
    { href: "/terms", label: t("terms.title") },
    { href: "/privacy#ccpa", label: t("footer.doNotSell") },
  ];

  const linkStyle: React.CSSProperties = {
    fontFamily: "var(--font-inter), system-ui, sans-serif",
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
              href="/"
              className="inline-flex items-center gap-2.5 mb-4"
              style={{ textDecoration: "none" }}
              aria-label="DocTalk home"
            >
              <DocTalkLogo size={22} />
              <span
                style={{
                  fontFamily: "var(--font-newsreader), Georgia, serif",
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
              AI document intelligence. Cite exactly.
            </p>
          </div>

          {/* Link columns */}
          <div className="md:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-8">
            <FooterLinkGroup heading={t("footer.product")} links={productLinks} />
            <FooterLinkGroup heading={t("footer.useCases")} links={useCaseLinks} />
            <FooterLinkGroup heading={t("footer.resources")} links={resourceLinks} />
            <FooterLinkGroup heading={t("footer.company")} links={companyLinks} />
          </div>
        </div>

        {/* Bottom fine-print row */}
        <hr className="ed-rule mt-10 mb-6" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <span className="ed-caption">{t("footer.copyright")}</span>
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
