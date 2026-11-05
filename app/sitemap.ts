import type { MetadataRoute } from 'next';
import { MARKETING_ROUTES, siteUrl } from '@/lib/site';
import { crossedRoutes } from '@/lib/crossed';

/** Only the marketing routes. A portal in a sitemap is an invitation to crawl it. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const fixed = MARKETING_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));

  /*
   * The crossed pages, § 5. Listed below the fixed routes and at a lower priority:
   * they exist to be found by someone searching for a service in a place, not to
   * outrank the pages that explain what the business actually is.
   */
  const crossed = crossedRoutes().map(({ path }) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...fixed, ...crossed];
}
