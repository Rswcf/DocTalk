import Link from "next/link";

interface RelatedLink {
  href: string;
  label: string;
}

interface EdRelatedLinksProps {
  title: string;
  links: RelatedLink[];
}

export default function EdRelatedLinks({ title, links }: EdRelatedLinksProps) {
  return (
    <div>
      <div className="ed-label">{title}</div>
      <div
        className="flex flex-wrap gap-x-6 gap-y-2.5"
        style={{ marginTop: "16px" }}
      >
        {links.map((link, index) => (
          <Link key={`rl-${index}`} href={link.href} className="ed-link">
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
