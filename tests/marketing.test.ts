/**
 * W1 and W2 gates, plus the structured-data block of spec § 11.
 *
 * Most of these are source assertions rather than rendered ones. That is deliberate for
 * the rules that are about what the codebase may contain — a hardcoded rate, an emoji, a
 * health-provider schema type — because those must fail before a page is ever rendered.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { RATE_REVALIDATE_SECONDS } from '@/lib/rates';

const ROOT = new URL('..', import.meta.url).pathname;

function filesUnder(dir: string, match: RegExp): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (match.test(name)) out.push(full);
    }
  };
  walk(dir);
  return out;
}

const marketingPages = filesUnder(join(ROOT, 'app/(marketing)'), /\.tsx$/);
const allSource = [
  ...filesUnder(join(ROOT, 'app'), /\.(ts|tsx)$/),
  ...filesUnder(join(ROOT, 'components'), /\.(ts|tsx)$/),
];
const read = (p: string) => readFileSync(p, 'utf8');
const rel = (p: string) => `/${p.replace(ROOT, '').replace(/^\//, '')}`;
/** Comments explain which types are banned; only the code may not contain them. */
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('W1 — the register is a private practice, not a marketplace', () => {
  const css = read(join(ROOT, 'app/globals.css'));

  it('constrains running text to a readable measure', () => {
    expect(css).toMatch(/--measure:\s*\d+ch/);
    expect(css).toMatch(/p,\s*li\s*\{[^}]*max-width:\s*var\(--measure\)/);
  });

  it('has no emoji in any component or page', () => {
    // Pictographs and dingbats. Punctuation like em dashes is fine; these are not.
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
    for (const file of [...allSource, join(ROOT, 'app/globals.css')]) {
      expect(emoji.test(read(file)), `${rel(file)} contains an emoji`).toBe(false);
    }
  });

  it('keeps every border radius at 6px or below', () => {
    for (const m of css.matchAll(/border-radius:\s*(\d+)px/g)) {
      expect(Number(m[1]), `border-radius ${m[1]}px`).toBeLessThanOrEqual(6);
    }
  });

  it('puts a shadow on exactly one class — the bench card', () => {
    const rules = [...css.matchAll(/([.#][\w-]+)\s*\{[^}]*box-shadow:/g)].map((m) => m[1]);
    expect(rules).toEqual(['.bench-card']);
  });

  it('balances headings and tracks uppercase labels', () => {
    expect(css).toContain('text-wrap: balance');
    expect(css).toMatch(/\.label\s*\{[^}]*letter-spacing:\s*\.08em/);
  });

  it('uses tabular numerals wherever figures align', () => {
    expect(css).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });
});

describe('W2 — rates are live, never written into a page', () => {
  it('no page or content file contains a rate figure', () => {
    // A dollar amount in source is a rate that will drift. Under § 1812.533(b)(1) a
    // drifted published rate is a misleading advertisement, not just stale copy.
    const money = /\$\s?\d{2,3}(\.\d{2})?\b/;
    const contentFiles = [
      ...marketingPages,
      ...filesUnder(join(ROOT, 'content'), /\.(mdx|md|ts)$/),
    ];
    for (const file of contentFiles) {
      const code = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(money.test(code), `${rel(file)} hardcodes a rate`).toBe(false);
    }
  });

  it('the pricing page reads them from the database', () => {
    const pricing = read(join(ROOT, 'app/(marketing)/pricing/page.tsx'));
    expect(pricing).toContain('currentRateRanges');
  });

  it('revalidates hourly, and the literal agrees with the shared constant', () => {
    const pricing = read(join(ROOT, 'app/(marketing)/pricing/page.tsx'));
    const m = /export const revalidate = (\d+);/.exec(pricing);
    expect(m, 'pricing must declare a revalidate literal').toBeTruthy();
    // Next analyses this statically and cannot follow an imported constant, so the two
    // are separate by necessity. This is the assertion that keeps them in step.
    expect(Number(m![1])).toBe(RATE_REVALIDATE_SECONDS);
    expect(RATE_REVALIDATE_SECONDS).toBe(3600);
  });
});

describe('W2 — every marketing route carries the footer and says nothing it may not', () => {
  it('renders through the layout that holds the statutory footer', () => {
    const layout = read(join(ROOT, 'app/(marketing)/layout.tsx'));
    expect(layout).toContain('StatutoryFooter');
    for (const page of marketingPages) {
      if (page.endsWith('layout.tsx')) continue;
      expect(read(page), `${rel(page)} renders its own footer`).not.toContain('StatutoryFooter');
    }
  });

  it('has the six pages W2 calls for', () => {
    const routes = marketingPages
      .filter((p) => p.endsWith('page.tsx'))
      .map((p) => rel(p).replace('/app/(marketing)', '').replace('/page.tsx', '') || '/');
    for (const route of [
      '/', '/how-it-works', '/pricing', '/vetting', '/for-providers', '/for-partners',
    ]) {
      expect(routes, `${route} is missing`).toContain(route);
    }
  });

  it('gives every page a title and a description under the limits', () => {
    for (const page of marketingPages.filter((p) => p.endsWith('page.tsx'))) {
      const src = read(page);
      // `generateMetadata` counts as well as a static `metadata`. A page whose title
      // depends on its params — the § 5 crossed pages — cannot use the static form,
      // and the rule being enforced is that every page sets a title and description,
      // not which of the two APIs it uses. The crossed pages' own lengths are checked
      // in tests/crossed.test.ts, where the strings actually live.
      const hasMetadata = src.includes('export const metadata')
        || src.includes('export async function generateMetadata')
        || src.includes('export function generateMetadata');
      expect(hasMetadata, `${rel(page)} sets no metadata`).toBe(true);
      const title = /title:\s*'([^']+)'/.exec(src);
      if (title) expect(title[1]!.length, `${rel(page)} title`).toBeLessThanOrEqual(60);
    }
  });
});

describe('§ 11 — structured data claims nothing clinical', () => {
  const jsonLd = allSource.filter((f) => code(f).includes('application/ld+json'));

  it('is present on the home page', () => {
    expect(jsonLd.map(rel)).toContain('/app/(marketing)/page.tsx');
  });

  it('never uses a health-provider type', () => {
    for (const file of jsonLd) {
      const src = code(file);
      for (const banned of [
        'MedicalBusiness', 'HomeHealthCareService', 'Physician', 'Hospital',
        'MedicalOrganization', 'MedicalClinic',
      ]) {
        expect(src, `${rel(file)} claims ${banned}`).not.toContain(banned);
      }
    }
  });

  it('carries no rating, price range, award or accreditation property', () => {
    for (const file of jsonLd) {
      const src = code(file);
      for (const banned of [
        'aggregateRating', 'ratingValue', 'reviewCount', 'priceRange', 'award',
        'hasCredential', 'accreditation',
      ]) {
        expect(src, `${rel(file)} includes ${banned}`).not.toContain(banned);
      }
    }
  });

  it('noindexes the portals and leaves the marketing pages indexable', () => {
    const config = read(join(ROOT, 'next.config.ts'));
    for (const group of ['/portal/:path*', '/pro/:path*', '/partner/:path*']) {
      expect(config).toContain(group);
    }
    expect(config).toContain('noindex, nofollow, noarchive');
  });
});

describe('W4 — robots, sitemap and the advertising record', () => {
  it('allows the marketing pages and disallows every portal', async () => {
    const { default: robots } = await import('@/app/robots');
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0]! : rules;
    expect(rule.allow).toBe('/');
    for (const path of ['/portal', '/pro', '/partner', '/invite', '/api']) {
      expect(rule.disallow, `${path} is crawlable`).toContain(path);
    }
  });

  it('lists only the marketing routes in the sitemap', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const urls = sitemap().map((e) => new URL(e.url).pathname);
    expect(urls).toContain('/');
    expect(urls).toContain('/pricing');
    for (const portal of ['/portal', '/pro', '/partner', '/invite']) {
      expect(urls.some((u) => u.startsWith(portal)), `${portal} is in the sitemap`).toBe(false);
    }
  });

  it('emits absolute canonical URLs, not ones resolved against a preview host', async () => {
    const layout = read(join(ROOT, 'app/layout.tsx'));
    expect(layout).toContain('metadataBase');
  });

  it('claims no licensure, accreditation or award in metadata', () => {
    for (const file of allSource) {
      const src = code(file);
      for (const banned of ['accreditation', 'hasCredential', 'award:', 'license:']) {
        expect(src, `${rel(file)} claims ${banned}`).not.toContain(banned);
      }
    }
  });

  it('has a recorder CI can run, which never fails a deploy', () => {
    const script = readFileSync(join(ROOT, 'scripts/record-advertisement.mjs'), 'utf8');
    expect(script).toContain('advertising_log');
    // § 1812.533(c) bookkeeping must not be able to block a release.
    expect(script).toContain('exit(0)');
  });
});

describe('the marketing site deploys without a database', () => {
  it('pricing degrades to its empty state rather than failing the build', () => {
    const rates = readFileSync(join(ROOT, 'lib/rates.ts'), 'utf8');
    // /pricing is prerendered, so a throw in this query fails the whole build. A
    // marketing site that cannot deploy because the rates table blipped is worse than
    // one that says "call us" until the next revalidation.
    expect(rates).toMatch(/try\s*\{[\s\S]*catch/);
    expect(rates).toContain('return [];');
  });

  it('the pricing page has that empty state to fall back to', () => {
    const page = readFileSync(join(ROOT, 'app/(marketing)/pricing/page.tsx'), 'utf8');
    expect(page).toContain('services.length === 0');
  });
});

describe('the site stays up when the database does not', () => {
  const guarded = [
    ['app/login/page.tsx', 'signing in'],
    ['app/(client)/layout.tsx', 'the client portal'],
    ['app/invite/[token]/route.ts', 'an invite link'],
  ] as const;

  it.each(guarded)('%s checks the database before using it', (file) => {
    expect(read(join(ROOT, file))).toContain('databaseAvailable');
  });

  it('shows something a visitor can act on rather than a 500', () => {
    const c = read(join(ROOT, 'components/Unavailable.tsx'));
    expect(c).toMatch(/temporarily unavailable/i);
    expect(c).toMatch(/call us/i);
  });

  it('names no cause — a public page is not where that belongs', () => {
    // The comment explains the rule and may use the words; the rendered page may not.
    const rendered = read(join(ROOT, 'components/Unavailable.tsx'))
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const leak of ['DATABASE_URL', 'Postgres', 'connection', 'ECONNREFUSED']) {
      expect(rendered, `the unavailable page leaks "${leak}"`).not.toContain(leak);
    }
  });

  it('has a health route that reports configuration by name, never by value', () => {
    const h = read(join(ROOT, 'app/api/health/route.ts'));
    expect(h).toContain('databaseAvailable');
    expect(h).toContain('brandBlockers');
    expect(h).toContain('noindex');
    // Names only. None of these may be interpolated into the response.
    expect(h).not.toContain('process.env.DATABASE_URL');
    expect(h).not.toContain('LEGAL_NAME,');
  });
});

describe('a page that cannot carry the required footer is not served', () => {
  it('the layout withholds the marketing content rather than failing the build', () => {
    const layout = read(join(ROOT, 'app/(marketing)/layout.tsx'));
    expect(layout).toContain('brandBlockers()');
    expect(layout).toContain('NotPublished');
  });

  it('nothing throws during a build any more — that took the portals down too', () => {
    const footer = read(join(ROOT, 'components/StatutoryFooter.tsx'));
    const code = footer.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toContain('throw new Error');
    expect(code).not.toContain('VERCEL_ENV');
  });

  it('the holding page is not itself an advertisement', () => {
    const page = read(join(ROOT, 'components/NotPublished.tsx'));
    const rendered = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    // No name, no services, no claim — nothing for § 1812.533(b)(2) to attach to.
    for (const claim of ['nursing', 'care', 'registry', 'referral', 'LEGAL_NAME', 'DISPLAY_NAME']) {
      expect(rendered.toLowerCase(), `the holding page claims "${claim}"`)
        .not.toContain(claim.toLowerCase());
    }
  });

  it('and is not indexable, so it cannot outrank the real site later', () => {
    expect(read(join(ROOT, 'app/(marketing)/layout.tsx'))).toContain('index: false');
  });
});

/**
 * Metadata is withheld with the body, not alongside it.
 *
 * Found on the live deployment. The marketing layout refuses to render the body while
 * `brandBlockers()` is non-empty, but metadata is not the body: every title read
 * "… · PENDING_LEGAL_NAME" — an internal sentinel in the browser tab and in every
 * link preview — and each page still served its real marketing description under a
 * body saying the site is not published.
 *
 * A meta description is advertising copy, and § 1812.533(b)(2) wanting the correct
 * name in every advertisement is the whole reason the body is withheld. Shipping the
 * description while withholding the page is the same breach wearing a different tag.
 */
describe('nothing advertises while the brand is withheld', () => {
  it('every public page wraps its metadata in the gate', () => {
    for (const page of marketingPages.filter((p) => p.endsWith('page.tsx'))) {
      const src = read(page);
      const sets = src.includes('export const metadata')
        || src.includes('generateMetadata');
      if (!sets) continue;
      expect(
        src.includes('publicMetadata'),
        `${rel(page)} sets metadata without publicMetadata, so it advertises while withheld`,
      ).toBe(true);
    }
  });

  it('the gate strips the title, description and openGraph', async () => {
    const { publicMetadata, NOT_PUBLISHED_TITLE } = await import('@/lib/brand');
    const base = {
      title: 'Post-Surgical Recovery Care in Beverly Hills',
      description: 'Private recovery cover, arranged after a call.',
      openGraph: { title: 'x', description: 'y' },
    };
    const out = publicMetadata(base) as Record<string, unknown>;
    // tests/setup.ts configures a name and phone, so nothing is blocked here and the
    // base passes through untouched — which is the branch that must not over-fire.
    expect(out.description).toBe(base.description);
    expect(out.title).toBe(base.title);
    expect(NOT_PUBLISHED_TITLE).toBe('Not yet published');
  });

  it('withholds when the name is missing', async () => {
    // Re-import with the brand unset, which is the deployed state today.
    const name = process.env.NEXT_PUBLIC_LEGAL_NAME;
    const phone = process.env.NEXT_PUBLIC_PHONE;
    delete process.env.NEXT_PUBLIC_LEGAL_NAME;
    delete process.env.NEXT_PUBLIC_PHONE;
    vi.resetModules();
    try {
      const brand = await import('@/lib/brand');
      const out = brand.publicMetadata({
        title: 'Real marketing title',
        description: 'Real marketing description.',
        openGraph: { title: 'x' },
      }) as Record<string, unknown>;
      expect(out.description).toBeUndefined();
      expect(out.openGraph).toBeUndefined();
      expect(out.title).toEqual({ absolute: brand.NOT_PUBLISHED_TITLE });
      expect(JSON.stringify(out)).not.toContain('PENDING_LEGAL_NAME');
    } finally {
      if (name) process.env.NEXT_PUBLIC_LEGAL_NAME = name;
      if (phone) process.env.NEXT_PUBLIC_PHONE = phone;
      vi.resetModules();
    }
  });
});
