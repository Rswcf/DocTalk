import type { MetadataRoute } from "next";
import { getAllCategories, getAllPosts } from "../lib/blog";

const BASE_URL = "https://www.doctalk.site";

export default function sitemap(): MetadataRoute.Sitemap {
  const generatedAt = new Date();
  const posts = getAllPosts();
  const categories = getAllCategories();

  return [
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
    // Use case pages
    { url: `${BASE_URL}/use-cases`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/use-cases/students`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/use-cases/lawyers`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/use-cases/finance`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/use-cases/hr-contracts`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
    // Blog content
    ...categories.map((category) => ({
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
}
