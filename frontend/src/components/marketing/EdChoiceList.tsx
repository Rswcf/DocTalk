import Link from "next/link";

interface ChoiceItem {
  need: string;
  pick: {
    label: string;
    href: string;
  };
}

interface EdChoiceListProps {
  items: ChoiceItem[];
}

export default function EdChoiceList({ items }: EdChoiceListProps) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item, index) => (
        <li
          key={`choice-${index}`}
          style={{
            borderTop: "1px solid var(--ed-rule)",
            borderBottom:
              index === items.length - 1
                ? "1px solid var(--ed-rule)"
                : undefined,
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "24px",
            padding: "14px 0",
          }}
        >
          <span className="ed-body" style={{ flex: 1 }}>
            {item.need}
          </span>
          <Link
            href={item.pick.href}
            className="ed-link"
            style={{ whiteSpace: "nowrap" }}
          >
            {item.pick.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
