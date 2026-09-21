import Link from "next/link";

/**
 * Editorial page hero.
 *
 * `variant="product"` is the Apple-grammar arrangement from
 * `.collab/plans/2026-09-20-apple-design-direction.md` §5.2: product label →
 * one claim → ONE supporting sentence → ONE filled action (with an optional
 * quiet text link) → the product itself. The product occupies the hero rather
 * than sitting below several screens of prose.
 *
 * The rule the variant exists to enforce: exactly one `ed-cta` above the fold.
 * A page that needs several actions (one per pricing plan, say) puts them in
 * its `product` node and passes no `primaryCta`, so the count stays at one
 * filled control per view either way.
 *
 * `variant="default"` is the legacy arrangement and is unchanged, so the 44
 * routes that have not been migrated keep rendering exactly as before.
 */
interface EdPageHeroProps {
  eyebrow?: string;
  title: React.ReactNode;
  lede?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  icon?: React.ComponentType<{ className?: string }>;
  meta?: React.ReactNode;
  variant?: "default" | "product";
  /** Rendered full-width directly under the action row. Product variant only. */
  product?: React.ReactNode;
}

export default function EdPageHero({
  eyebrow,
  title,
  lede,
  primaryCta,
  secondaryCta,
  icon: Icon,
  meta,
  variant = "default",
  product,
}: EdPageHeroProps) {
  const hasCta = !!(primaryCta || secondaryCta);

  if (variant === "product") {
    return (
      <section className="pt-16 pb-14">
        <div className="ed-shell">
          <div style={{ maxWidth: "820px" }}>
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
          {product && <div style={{ marginTop: "40px" }}>{product}</div>}
        </div>
      </section>
    );
  }

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
