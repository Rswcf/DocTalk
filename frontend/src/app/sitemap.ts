import type { MetadataRoute } from "next";
import { getAllPosts, KNOWN_BLOG_CATEGORIES } from "../lib/blog";
import { LOCALIZED_PATHS, URL_LOCALES, localizedHref } from "../i18n/routing";

const BASE_URL = "https://www.doctalk.site";

type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

/**
 * Priority for every entry in `LOCALIZED_PATHS`. The English entries are derived
 * from that set rather than hand-listed, so a newly localized page can no longer
 * ship with locale URLs but no English URL — the failure that hid
 * `/features/layout-translation` and `/trust` from the English sitemap.
 * `tests/sitemap-routes.test.cjs` asserts this map stays in sync with the set.
 *
 * Values are the ones the hand-written list already used. The two paths that
 * never had a value (`/features/layout-translation`, `/trust`) were classified
 * with Jev against their English hero copy — both landed on 0.7, matching their
 * siblings; see `scripts/seo/out/sitemap_priority.json` for the distributions.
 */
const LOCALIZED_PRIORITY: Record<string, number> = {
  "/": 1.0,
  "/demo": 0.8,
  "/pricing": 0.8,
  "/trust": 0.7,
  "/tools": 0.6,
  "/features": 0.7,
  "/features/citations": 0.8,
  "/features/free-demo": 0.7,
  "/features/layout-translation": 0.7,
  "/features/multi-format": 0.8,
  "/features/multilingual": 0.7,
  "/features/performance-modes": 0.6,
  "/compare": 0.6,
  "/compare/askyourpdf": 0.7,
  "/compare/chatpdf": 0.7,
  "/compare/humata": 0.7,
  "/compare/notebooklm": 0.7,
  "/compare/pdf-ai": 0.7,
  "/alternatives": 0.6,
  "/alternatives/askyourpdf": 0.7,
  "/alternatives/chatpdf": 0.7,
  "/alternatives/humata": 0.7,
  "/alternatives/notebooklm": 0.7,
  "/alternatives/pdf-ai": 0.7,
  "/use-cases": 0.7,
  "/use-cases/compliance": 0.7,
  "/use-cases/consultants": 0.7,
  "/use-cases/finance": 0.7,
  "/use-cases/healthcare": 0.7,
  "/use-cases/hr-contracts": 0.6,
  "/use-cases/lawyers": 0.7,
  "/use-cases/real-estate": 0.7,
  "/use-cases/students": 0.7,
  "/use-cases/teachers": 0.7,
};

/** Fallback for a localized path added without a priority (the test flags it too). */
const DEFAULT_LOCALIZED_PRIORITY = 0.7;

/** Reciprocal hreflang map for a localized path (unprefixed en + each URL locale + x-default). */
function languagesFor(path: string): Record<string, string> {
  const languages: Record<string, string> = { en: `${BASE_URL}${path}` };
  for (const loc of URL_LOCALES) {
    languages[loc] = `${BASE_URL}${localizedHref(loc, path)}`;
  }
  languages["x-default"] = `${BASE_URL}${path}`;
  return languages;
}

/** Absolute URL for a locale-agnostic path; the root has no trailing slash. */
function absolute(path: string): string {
  return path === "/" ? BASE_URL : `${BASE_URL}${path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const generatedAt = new Date();
  const posts = getAllPosts();

  // English entries for every localized path, derived from LOCALIZED_PATHS so the
  // two lists cannot drift. Each carries the reciprocal hreflang map.
  const localizedEnEntries: MetadataRoute.Sitemap = [...LOCALIZED_PATHS].map((path) => ({
    url: absolute(path),
    lastModified: generatedAt,
    changeFrequency: "monthly" as ChangeFrequency,
    priority: LOCALIZED_PRIORITY[path] ?? DEFAULT_LOCALIZED_PRIORITY,
    alternates: { languages: languagesFor(path) },
  }));

  // Pages that exist only in English (no `app/[locale]` route), so no hreflang.
  const englishOnlyEntries: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/blog`, lastModified: generatedAt, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/about`, lastModified: generatedAt, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE_URL}/contact`, lastModified: generatedAt, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE_URL}/privacy`, lastModified: generatedAt, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: generatedAt, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/tools/word-counter`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/tools/reading-time`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
    ...KNOWN_BLOG_CATEGORIES.map((category) => ({
      url: `${BASE_URL}/blog/category/${category}`,
      lastModified: generatedAt,
      changeFrequency: "weekly" as ChangeFrequency,
      priority: 0.6,
    })),
    ...posts.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.updated || post.date),
      changeFrequency: "monthly" as ChangeFrequency,
      priority: 0.7,
    })),
  ];

  // One entry per (localized path x URL locale), each carrying the same reciprocal map.
  const localeEntries: MetadataRoute.Sitemap = [];
  for (const path of LOCALIZED_PATHS) {
    const languages = languagesFor(path);
    for (const loc of URL_LOCALES) {
      localeEntries.push({
        url: `${BASE_URL}${localizedHref(loc, path)}`,
        lastModified: generatedAt,
        changeFrequency: "monthly",
        priority: 0.7,
        alternates: { languages },
      });
    }
  }

  return [...localizedEnEntries, ...englishOnlyEntries, ...localeEntries];
}
