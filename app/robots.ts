import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';
import { indexable } from '@/lib/brand';

/**
 * Spec § 8. The marketing pages are indexable; the portals never are.
 *
 * A robots.txt disallow is a request. The `X-Robots-Tag` header in next.config.ts is
 * the instruction, and both are set — this file stops a crawler fetching, the header
 * stops it indexing what it fetched anyway.
 */
export default function robots(): MetadataRoute.Robots {
  /*
   * Nothing at all while the name in use is a stand-in.
   *
   * `indexable()` asks two things: that there is something to serve, and that somebody
   * has said the configured name is the one on file. A site put up to be looked at
   * answers the first and not the second, and a crawler cannot tell the difference —
   * so it is told to stay away, and no sitemap is offered to argue otherwise.
   */
  if (!indexable()) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/portal', '/pro', '/partner', '/invite', '/api'],
    }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
