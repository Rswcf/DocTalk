// FAQPage and ItemList structured data derived from a blog post's own markdown,
// so the schema always matches the visible text (Google requires that for
// FAQPage) and nobody maintains a second copy. Answer engines read these blocks
// as self-contained question/answer pairs and ranked lists.

import { extractHeadingIdsByOffset, headingTextFromMarkdown } from './blogHeadings';

export interface FaqItem {
  question: string;
  answer: string;
}

export interface RankedItem {
  position: number;
  name: string;
  anchor: string;
}

const FAQ_HEADING = /^##\s+(?:Frequently Asked Questions|FAQs?)\s*$/im;
// "## The 7 Best ChatPDF Alternatives", "## 7 Best …" — the ranked list section.
const RANKED_SECTION = /^##\s+(?:The\s+)?\d+\s+Best\b.*$/im;
const RANKED_ITEM = /^###\s+(\d+)\.\s+(.+)$/gm;

/** Markdown answer text → plain text (links keep their label; emphasis, code, images and HTML dropped). */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|\W)__(.+?)__(?=\W|$)/g, '$1$2')
    .replace(/\*(.+?)\*/g, '$1')
    // Underscore emphasis only at word boundaries, so utm_source survives.
    .replace(/(^|\W)_(.+?)_(?=\W|$)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The section that starts at `heading` and ends at the next `## ` heading. */
function sectionAfter(content: string, heading: RegExp): { body: string; offset: number } | null {
  const m = heading.exec(content);
  if (!m) return null;
  const start = m.index + m[0].length;
  const rest = content.slice(start);
  const next = rest.search(/^##\s/m);
  return { body: next === -1 ? rest : rest.slice(0, next), offset: start };
}

export function extractFaq(content: string): FaqItem[] {
  const section = sectionAfter(content, FAQ_HEADING);
  if (!section) return [];
  const parts = section.body.split(/^###\s+/m).slice(1);
  const items: FaqItem[] = [];
  for (const part of parts) {
    const newline = part.indexOf('\n');
    const question = headingTextFromMarkdown((newline === -1 ? part : part.slice(0, newline)).trim());
    const answer = markdownToPlainText(newline === -1 ? '' : part.slice(newline + 1));
    if (question && answer) items.push({ question, answer });
  }
  return items;
}

export function extractRankedItems(content: string): RankedItem[] {
  const section = sectionAfter(content, RANKED_SECTION);
  if (!section) return [];
  const ids = extractHeadingIdsByOffset(content);
  const items: RankedItem[] = [];
  RANKED_ITEM.lastIndex = 0;
  let m;
  while ((m = RANKED_ITEM.exec(section.body)) !== null) {
    const anchor = ids.get(section.offset + m.index);
    // "[ChatPDF](https://chatpdf.com) — Simplest PDF Chat" → "ChatPDF"
    const name = headingTextFromMarkdown(m[2]).split(/\s+[—–-]\s+/)[0].trim();
    if (anchor && name) items.push({ position: Number(m[1]), name, anchor });
  }
  return items.length >= 2 ? items : [];
}

/** schema.org ItemList for an all-in-one-page ranked list: each ListItem carries its name and in-page anchor under `item`. */
export function buildRankedItemList(title: string, postUrl: string, items: RankedItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    numberOfItems: items.length,
    itemListElement: items.map(({ position, name, anchor }) => ({
      '@type': 'ListItem',
      position,
      item: { '@type': 'Thing', name, url: `${postUrl}#${anchor}` },
    })),
  };
}

/** schema.org FAQPage built from the post's FAQ pairs. */
export function buildFaqPage(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

/** JSON for a <script type="application/ld+json">, with "<" escaped so text can never close the tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
