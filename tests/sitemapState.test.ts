/**
 * `robots.txt` and `sitemap.xml` have to agree, in both of the states this site has.
 *
 * WHAT IS ALREADY TESTED, AND WHAT WAS NOT. `tests/doors.test.ts` checks that
 * `MARKETING_ROUTES` and the filesystem name the same pages, in both directions — a real
 * rule, and it passes. What nothing checked is the function that READS that list.
 * `sitemap()` returns `[]` whenever `indexable()` is false, and `indexable()` requires a
 * filed name, which no deployment has yet. So the live `sitemap.xml` is an empty
 * `<urlset>`, every test about the sitemap passes, and not one of them has ever entered
 * the branch that produces a sitemap.
 *
 * The empty one is correct today: `robots.txt` answers `Disallow: /`, the footer says the
 * name is a stand-in, and both modules say in their own comments that this is deliberate.
 * The untested thing is the other side of the switch. On the day somebody sets
 * NEXT_PUBLIC_NAME_IS_FILED=1 the site starts advertising itself, and the first time
 * anyone finds out whether the sitemap populates correctly is in production, from a
 * crawler.
 *
 * So the rule asserted here is the agreement rather than either state: robots offers a
 * sitemap exactly when there is a sitemap to offer. Each direction is a way to be wrong
 * in public — a disallowed site handing out a list of pages to crawl, or an indexed site
 * whose sitemap is an empty document.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

type SitemapEntry = { url: string };
type Robots = {
  sitemap?: string | string[];
  rules: { userAgent?: string; allow?: string | string[]; disallow?: string | string[] }[];
};

/** Load robots, sitemap and the route list together, under one environment. */
async function siteIn(env: Record<string, string | undefined>) {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.resetModules();

  const [sitemapMod, robotsMod, brand, site, crossed] = await Promise.all([
    import('@/app/sitemap'), import('@/app/robots'), import('@/lib/brand'),
    import('@/lib/site'), import('@/lib/crossed'),
  ]);

  return {
    indexable: brand.indexable(),
    entries: sitemapMod.default() as SitemapEntry[],
    robots: robotsMod.default() as Robots,
    routes: site.MARKETING_ROUTES.map((r) => r.path),
    crossed: crossed.crossedRoutes().map((c) => c.path),
    base: site.siteUrl(),
    restore() {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      vi.resetModules();
    },
  };
}

const PRELAUNCH = {
  NEXT_PUBLIC_NAME_IS_FILED: undefined,
  NEXT_PUBLIC_LEGAL_NAME: undefined,
  NEXT_PUBLIC_PHONE: undefined,
  NEXT_PUBLIC_STREET: undefined,
};

const FILED = {
  NEXT_PUBLIC_NAME_IS_FILED: '1',
  NEXT_PUBLIC_LEGAL_NAME: 'Example Registry LLC',
  NEXT_PUBLIC_PHONE: '(310) 555-0100',
  NEXT_PUBLIC_STREET: undefined,
};

let open: { restore(): void } | null = null;
afterEach(() => {
  open?.restore();
  open = null;
});

describe('before a name is filed, the site offers nothing', () => {
  it('serves an empty sitemap and refuses every crawler', async () => {
    const site = await siteIn(PRELAUNCH);
    open = site;

    expect(site.indexable).toBe(false);
    expect(site.entries).toEqual([]);
    // The same answer given twice, which is what both modules say they intend.
    expect(site.robots.rules[0]?.disallow).toBe('/');
    expect(site.robots.sitemap).toBeUndefined();
  });
});

describe('once a name is filed, the site publishes itself', () => {
  /*
   * THE BRANCH NO TEST HAD EVER ENTERED. Every assertion below was true of unreached
   * code until this file existed.
   */
  it('becomes indexable and names a sitemap', async () => {
    const site = await siteIn(FILED);
    open = site;

    expect(site.indexable, 'a filed name with a phone number is still not indexable')
      .toBe(true);
    expect(site.robots.rules[0]?.allow).toBe('/');
    expect(site.robots.sitemap).toBe(`${site.base}/sitemap.xml`);
  });

  it('lists every marketing route, each as an absolute URL', async () => {
    const site = await siteIn(FILED);
    open = site;

    expect(site.entries.length).toBeGreaterThan(0);
    const urls = new Set(site.entries.map((e) => e.url));

    for (const path of site.routes) {
      expect(urls.has(`${site.base}${path}`), `${path} is in MARKETING_ROUTES and not in the sitemap`)
        .toBe(true);
    }
    for (const url of urls) {
      expect(url.startsWith('https://') || url.startsWith('http://'), `${url} is not absolute`)
        .toBe(true);
    }
    // The three doors in particular: a write path nobody can find is the defect this
    // repository has already shipped once.
    for (const door of ['/enquire', '/refer', '/apply']) {
      expect(urls.has(`${site.base}${door}`), `${door} is not in the sitemap`).toBe(true);
    }
  });

  it('lists the crossed pages too, and nothing twice', async () => {
    const site = await siteIn(FILED);
    open = site;

    const urls = site.entries.map((e) => e.url);
    for (const path of site.crossed) {
      expect(urls, `the crossed page ${path} is not in the sitemap`)
        .toContain(`${site.base}${path}`);
    }
    expect(urls.length, 'the sitemap lists the same URL twice').toBe(new Set(urls).size);
  });

  it('keeps the portals out of it', async () => {
    const site = await siteIn(FILED);
    open = site;

    // A portal in a sitemap is an invitation to crawl it, which is the module's own
    // reason for existing. The disallow list is the second half of the same intent.
    for (const url of site.entries.map((e) => e.url)) {
      expect(url, `${url} is a portal path and is in the sitemap`)
        .not.toMatch(/\/(portal|pro|partner|invite|api)(\/|$)/);
    }
    expect(site.robots.rules[0]?.disallow)
      .toEqual(['/portal', '/pro', '/partner', '/invite', '/api']);
  });
});

describe('the two files never disagree', () => {
  /*
   * The rule, rather than its two instances. Stated this way it also covers the state
   * nobody has thought of: a filed name with no contact detail, which `brandBlockers()`
   * keeps un-indexable even though NEXT_PUBLIC_NAME_IS_FILED is set.
   */
  const STATES: { what: string; env: Record<string, string | undefined> }[] = [
    { what: 'nothing configured', env: PRELAUNCH },
    { what: 'a filed name and a phone number', env: FILED },
    {
      what: 'a filed name and a street address instead',
      env: {
        NEXT_PUBLIC_NAME_IS_FILED: '1',
        NEXT_PUBLIC_LEGAL_NAME: 'Example Registry LLC',
        NEXT_PUBLIC_PHONE: undefined,
        NEXT_PUBLIC_STREET: '1 Example Plaza, Los Angeles, CA 90067',
      },
    },
    {
      what: 'a filed name with no way to contact anybody',
      env: {
        NEXT_PUBLIC_NAME_IS_FILED: '1',
        NEXT_PUBLIC_LEGAL_NAME: 'Example Registry LLC',
        NEXT_PUBLIC_PHONE: undefined,
        NEXT_PUBLIC_STREET: undefined,
      },
    },
    {
      what: 'a name claimed as filed but never configured',
      env: {
        NEXT_PUBLIC_NAME_IS_FILED: '1',
        NEXT_PUBLIC_LEGAL_NAME: undefined,
        NEXT_PUBLIC_PHONE: '(310) 555-0100',
        NEXT_PUBLIC_STREET: undefined,
      },
    },
  ];

  for (const { what, env } of STATES) {
    it(`agrees with ${what}`, async () => {
      const site = await siteIn(env);
      open = site;

      const offersSitemap = site.robots.sitemap !== undefined;
      const hasSitemap = site.entries.length > 0;

      expect(
        offersSitemap,
        offersSitemap
          ? 'robots.txt points a crawler at a sitemap that lists nothing'
          : 'the sitemap lists pages that robots.txt tells crawlers to stay away from',
      ).toBe(hasSitemap);

      // And both follow the one decision, so neither can be changed on its own.
      expect(hasSitemap).toBe(site.indexable);
    });
  }
});
