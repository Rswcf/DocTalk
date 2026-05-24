import type { MetadataRoute } from "next";
import { getAllPosts, KNOWN_BLOG_CATEGORIES } from "../lib/blog";
import { LOCALIZED_PATHS, URL_LOCALES, localizedHref } from "../i18n/routing";

const BASE_URL = "https://www.doctalk.site";

/** Reciprocal hreflang map for a localized path (unprefixed en + each URL locale + x-default). */
function languagesFor(path: string): Record<string, string> {
  const languages: Record<string, string> = { en: `${BASE_URL}${path}` };
  for (const loc of URL_LOCALES) {
    languages[loc] = `${BASE_URL}${localizedHref(loc, path)}`;
  }
  languages["x-default"] = `${BASE_URL}${path}`;
  return languages;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const generatedAt = new Date();
  const posts = getAllPosts();

  const staticEntries: MetadataRoute.Sitemap = [
    // Static pages
    { url: BASE_URL, lastModified: generatedAt, changeFrequency: "monthly", priority: 1.0 },
    { url: `${BASE_URL}/demo`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/pricing`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/blog`, lastModified: generatedAt, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/about`, lastModified: generatedAt, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE_URL}/contact`, lastModified: generatedAt, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE_URL}/privacy`, lastModified: generatedAt, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: generatedAt, changeFrequency: "yearly", priority: 0.3 },
    // Feature pages
    { url: `${BASE_URL}/features`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/features/citations`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/features/multi-format`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/features/multilingual`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/features/free-demo`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/features/performance-modes`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
    // Comparison pages
    { url: `${BASE_URL}/compare`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/compare/chatpdf`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/compare/askyourpdf`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/compare/notebooklm`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/compare/humata`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/compare/pdf-ai`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    // Alternative pages
    { url: `${BASE_URL}/alternatives`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/alternatives/chatpdf`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/alternatives/notebooklm`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/alternatives/humata`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/alternatives/askyourpdf`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/alternatives/pdf-ai`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    // Use case pages
    { url: `${BASE_URL}/use-cases`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/use-cases/students`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/use-cases/lawyers`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/use-cases/finance`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/use-cases/hr-contracts`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/use-cases/teachers`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/use-cases/consultants`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/use-cases/real-estate`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/use-cases/healthcare`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/use-cases/compliance`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    // Tools pages
    { url: `${BASE_URL}/tools`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/tools/word-counter`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/tools/reading-time`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
    // Blog content
    ...KNOWN_BLOG_CATEGORIES.map((category) => ({
      url: `${BASE_URL}/blog/category/${category}`,
      lastModified: generatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...posts.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.updated || post.date),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  // International SEO: attach hreflang to the en entry of each localized path,
  // and append one entry per URL locale (each carrying the reciprocal map).
  const withAlternates = staticEntries.map((entry) => {
    const path = entry.url.replace(BASE_URL, "") || "/";
    return LOCALIZED_PATHS.has(path)
      ? { ...entry, alternates: { languages: languagesFor(path) } }
      : entry;
  });

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

  return [...withAlternates, ...localeEntries];
}
