import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getBaseUrl();
  if (!base) return [];

  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly" as const, priority: 1 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.8 },
  ];
}
