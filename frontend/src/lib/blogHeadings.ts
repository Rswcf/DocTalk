// Heading text and anchor ids for blog posts. The post page (client) uses these
// for the table of contents and heading ids; lib/blogSchema.ts (server) uses the
// same ids for ItemList item URLs, so a structured-data anchor always lands on
// the heading the reader sees.

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function headingTextFromMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

export function uniqueHeadingId(baseId: string, seen: Map<string, number>): string {
  const base = baseId || 'section';
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

/** Anchor id of every `##`/`###` heading, keyed by its offset in the markdown. */
export function extractHeadingIdsByOffset(content: string): Map<number, string> {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const ids = new Map<number, string>();
  const seen = new Map<string, number>();
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const text = headingTextFromMarkdown(match[2].trim());
    ids.set(match.index, uniqueHeadingId(slugifyHeading(text), seen));
  }
  return ids;
}
