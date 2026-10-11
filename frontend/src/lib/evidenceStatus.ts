import type { TextEvidenceKind } from './textEvidence';

export type EvidenceStatus = TextEvidenceKind | 'loading' | 'unavailable';

/** What the text view has mounted: evidence marks by kind, and Markdown
 *  bodies (react-markdown loads lazily, so a page may still be a spinner). */
export interface RenderedMarks { exact: number; region: number; bodies: number }

export const NO_RENDERED_MARKS: RenderedMarks = { exact: 0, region: 0, bodies: 0 };

/**
 * The status the evidence bar shows. A located range can render no mark (it
 * sits in raw HTML that react-markdown drops, it cuts a character reference,
 * or its node cannot be aligned unambiguously), so the label follows the
 * marks that rendered, never only what was located: an exact mark → `exact`,
 * region marks only → `region`, no mark → `page`. It never claims more than
 * was located, and while no Markdown body has mounted it is `loading`.
 */
export function shownEvidenceStatus(located: EvidenceStatus, rendered: RenderedMarks): EvidenceStatus {
  if (located !== 'exact' && located !== 'region') return located;
  if (!rendered.bodies) return 'loading';
  if (located === 'exact' && rendered.exact > 0) return 'exact';
  return rendered.exact + rendered.region > 0 ? 'region' : 'page';
}
