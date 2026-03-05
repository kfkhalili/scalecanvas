/**
 * Base URL for the site. Used for canonical URLs, sitemap, robots, and Open Graph.
 * Prefers NEXT_PUBLIC_SITE_URL; on Vercel falls back to https://VERCEL_URL.
 */
export function getBaseUrl(): string | undefined {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv && fromEnv !== "") {
    try {
      new URL(fromEnv);
      return fromEnv.replace(/\/$/, "");
    } catch {
      // invalid URL, try fallback
    }
  }
  const vercel = process.env.VERCEL_URL;
  if (vercel && vercel !== "") {
    return `https://${vercel}`;
  }
  return undefined;
}
