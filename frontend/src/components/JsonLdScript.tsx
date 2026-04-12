/**
 * Helper that renders a JSON-LD `<script type="application/ld+json">`
 * with an optional CSP nonce.
 *
 * This is a **pure** component — it does NOT call `headers()` itself.
 * Calling `headers()` inside a server component forces the containing page
 * into dynamic rendering, breaking static prerender + CDN caching on SEO
 * pages. The caller is responsible for fetching the nonce only when the
 * page is already dynamic.
 *
 * Usage:
 *   // Static page (no nonce, relies on CSP 'unsafe-inline' until P3 full migration):
 *   <JsonLdScript data={{...}} />
 *
 *   // Dynamic page (safe to fetch nonce):
 *   const nonce = (await headers()).get("x-nonce") ?? undefined;
 *   <JsonLdScript data={{...}} nonce={nonce} />
 *
 * See `.collab/plans/p3-csp-nonce-plan.md` for the full migration roadmap.
 *
 * IMPORTANT: `data` is JSON-stringified; DO NOT pass user-controlled fields
 * without validation. JSON-LD is a data script — the browser won't execute
 * it — but malformed structure can break Googlebot parsing.
 */

// JSON-LD top level can be a single object OR an array of objects (e.g.
// BreadcrumbList + Article together). Allow both.
export type JsonLdData =
  | Record<string, unknown>
  | Array<Record<string, unknown>>;

export default function JsonLdScript({
  data,
  nonce,
}: {
  data: JsonLdData;
  nonce?: string;
}) {
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
