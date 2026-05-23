interface FeatureItem {
  title: string;
  body: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface EdFeatureListProps {
  items: FeatureItem[];
}

export default function EdFeatureList({ items }: EdFeatureListProps) {
  return (
    <div>
      {items.map((item, index) => {
        const Icon = item.icon;
        const isFirst = index === 0;
        const num = String(index + 1).padStart(2, "0");

        return (
          <div
            key={`feature-${index}`}
            style={{
              display: "grid",
              gridTemplateColumns: "56px 1fr",
              gap: "24px",
              padding: "28px 0",
              borderTop: isFirst ? undefined : "1px solid var(--ed-rule)",
            }}
          >
            {/* Mono number column */}
            <div
              style={{
                fontFamily: "var(--dt-mono)",
                fontSize: "13px",
                color: "var(--ed-signal)",
                letterSpacing: "0.04em",
                lineHeight: 1,
                paddingTop: "3px",
              }}
            >
              {num}
            </div>

            {/* Content column */}
            <div>
              {Icon && (
                <div
                  style={{ marginBottom: "10px", color: "var(--ed-ink-3)" }}
                >
                  <Icon className="w-4 h-4" />
                </div>
              )}
              <h3 className="ed-h3">{item.title}</h3>
              <p className="ed-body" style={{ marginTop: "6px" }}>
                {item.body}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
