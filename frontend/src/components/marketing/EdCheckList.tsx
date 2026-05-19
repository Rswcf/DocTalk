interface EdCheckListProps {
  items: string[];
}

export default function EdCheckList({ items }: EdCheckListProps) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item, index) => (
        <li
          key={`check-${index}`}
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "10px",
            marginBottom: index === items.length - 1 ? 0 : "7px",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
              fontSize: "12px",
              color: "var(--ed-signal)",
              flexShrink: 0,
            }}
          >
            ✓
          </span>
          <span className="ed-body">{item}</span>
        </li>
      ))}
    </ul>
  );
}
