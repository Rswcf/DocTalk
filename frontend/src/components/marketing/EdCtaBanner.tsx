import Link from "next/link";

interface CtaLink {
  label: string;
  href: string;
}

interface EdCtaBannerProps {
  title?: string;
  description?: string;
  primary: CtaLink;
  secondary?: CtaLink;
}

export default function EdCtaBanner({
  title,
  description,
  primary,
  secondary,
}: EdCtaBannerProps) {
  return (
    <section
      className="ed-section"
      style={{
        background: "var(--ed-paper-2)",
        borderTop: "1px solid var(--ed-rule)",
      }}
    >
      <div className="ed-shell">
        <div
          style={{
            textAlign: "center",
            margin: "0 auto",
            maxWidth: "640px",
          }}
        >
          {title && <h2 className="ed-h2">{title}</h2>}

          {description && (
            <p
              className="ed-lede"
              style={title ? { marginTop: "14px" } : undefined}
            >
              {description}
            </p>
          )}

          <div
            style={{
              marginTop: "26px",
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Link href={primary.href} className="ed-cta">
              {primary.label}
            </Link>

            {secondary && (
              <Link href={secondary.href} className="ed-link">
                {secondary.label} <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
