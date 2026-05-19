interface EdSectionProps {
  label?: string;
  num?: string;
  title?: string;
  alt?: boolean;
  children: React.ReactNode;
  id?: string;
}

export default function EdSection({
  label,
  num,
  title,
  alt,
  children,
  id,
}: EdSectionProps) {
  const hasHeader = !!(label || num || title);

  return (
    <section
      id={id}
      className="ed-section"
      style={alt ? { background: "var(--ed-paper-2)" } : undefined}
    >
      {!alt && <hr className="ed-rule" />}
      <div className="ed-shell">
        {(label || num) && (
          <div className="ed-label">
            {num && label ? (
              <>
                <span className="ed-label-num">{num}</span>
                {" — "}
                {label}
              </>
            ) : num ? (
              <span className="ed-label-num">{num}</span>
            ) : (
              label
            )}
          </div>
        )}
        {title && (
          <h2
            className="ed-h2"
            style={label || num ? { marginTop: "12px" } : undefined}
          >
            {title}
          </h2>
        )}
        <div style={hasHeader ? { marginTop: "32px" } : undefined}>
          {children}
        </div>
      </div>
    </section>
  );
}
