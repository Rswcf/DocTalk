interface CardItem {
  label?: string;
  title: string;
  body?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface EdCardGridProps {
  items: CardItem[];
  columns?: 2 | 3;
}

export default function EdCardGrid({ items, columns = 3 }: EdCardGridProps) {
  const colClass = columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";

  return (
    <div
      className={`grid grid-cols-1 ${colClass}`}
      style={{ gap: "16px", gridAutoRows: "1fr" }}
    >
      {items.map((item, index) => {
        const Icon = item.icon;

        return (
          <div
            key={`card-${index}`}
            className="ed-card h-full"
            style={{ display: "flex", flexDirection: "column" }}
          >
            {Icon && (
              <div
                style={{ marginBottom: "10px", color: "var(--ed-ink-3)" }}
              >
                <Icon className="w-4 h-4" />
              </div>
            )}
            {item.label && (
              <div className="ed-label" style={{ marginBottom: "8px" }}>
                {item.label}
              </div>
            )}
            <h3 className="ed-h3">{item.title}</h3>
            {item.body && (
              <p className="ed-body" style={{ marginTop: "8px" }}>
                {item.body}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
