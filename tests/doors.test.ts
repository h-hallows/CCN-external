/**
 * The doors, and the rules that keep one from being built and then orphaned.
 *
 * THE FAILURE THIS FILE IS ABOUT. `/api/inquiry` and `/api/apply` were deployed,
 * validated against strict schemas, rate-limited and honeypotted — and nothing on the
 * site called either of them. The whole application contained exactly one `fetch(`, to
 * `/api/refer`, and `/refer` itself was linked from two places, both inside the partner
 * portal, which needs an invite from an operator. A discharge planner had to already be
 * a customer to find the form that makes them one.
 *
 * Every one of those surfaces was correct. The tests passed. What nobody was asking was
 * whether a person could get to them, which is the same question the console's five
 * dead mechanisms turned out to be about: for every path, who reaches it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MARKETING_ROUTES } from '@/lib/site';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => readFileSync(p, 'utf8');

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

/** Every fixed marketing route, derived from the filesystem rather than listed here. */
function marketingRoutes(): string[] {
  const base = join(ROOT, 'app/(marketing)');
  return filesUnder(base, /^page\.tsx$/)
    .map((p) => p.replace(base, '').replace(/\/page\.tsx$/, ''))
    // The crossed pages are dynamic and are listed in the sitemap from their content.
    .filter((r) => !r.includes('['))
    .map((r) => (r === '' ? '/' : r));
}

const marketingSource = filesUnder(join(ROOT, 'app/(marketing)'), /\.tsx$/)
  .concat(filesUnder(join(ROOT, 'components'), /\.tsx$/))
  .map((p) => ({ path: p, src: read(p) }));

const allHrefs = marketingSource
  .flatMap(({ src }) => [...src.matchAll(/href=[{"'`]+([^"'`}\s]+)/g)].map((m) => m[1]!));

describe('every public write path has a door on the front of it', () => {
  /*
   * Stated as a rule rather than as three assertions, so a fourth intake route added
   * later is covered by the same test. A route under app/api that takes a POST and
   * nothing fetches is a pipeline with nothing attached to it.
   */
  const intakeRoutes = filesUnder(join(ROOT, 'app/api'), /^route\.ts$/)
    .map((p) => ({
      endpoint: p.replace(join(ROOT, 'app'), '').replace(/\/route\.ts$/, ''),
      src: read(p),
    }))
    .filter(({ src }) => /export async function POST/.test(src));

  /*
   * Every `/api/...` named by something that is not an API route — in a fetch call or
   * handed to the shared `postIntake`, which takes the endpoint as an argument.
   * Comments are stripped first: the prose in these files says `/api/refer` and
   * `/api/inquiry` several times, and a scan that counts those would pass on a site
   * where nothing calls anything.
   */
  const callers = filesUnder(join(ROOT, 'app'), /\.tsx$/)
    .concat(filesUnder(join(ROOT, 'components'), /\.tsx$/))
    .map((p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''));
  const fetched = callers
    .flatMap((src) => [...src.matchAll(/['"`](\/api\/[a-z-]+)['"`]/g)].map((m) => m[1]!));

  it('finds a POST route for each of the three forms', () => {
    const endpoints = intakeRoutes.map((r) => r.endpoint).sort();
    expect(endpoints).toContain('/api/inquiry');
    expect(endpoints).toContain('/api/apply');
    expect(endpoints).toContain('/api/refer');
  });

  it('has something on the site that actually posts to each of them', () => {
    for (const { endpoint } of intakeRoutes) {
      // /api/health takes no POST and is filtered out above; anything else that does
      // is a public write path and needs a caller.
      expect(fetched, `${endpoint} is deployed and nothing on the site posts to it`)
        .toContain(endpoint);
    }
  });
});

describe('a door can be reached from the page that argues for it', () => {
  /*
   * A LINK, not the string. The first version of these asserted the path appeared in
   * the file, and every one of them stayed green when the button was deleted — because
   * each page also names the path in the comment explaining why the link is there, and
   * the homepage links `/enquire?care=...` from its service cards. A sabotage pass is
   * the only reason that is not still true.
   */
  function links(file: string, href: string): boolean {
    const src = read(join(ROOT, file))
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    return new RegExp(`<Link[^>]*href=(?:"${href}"|\\{'${href}'\\})`).test(src);
  }

  it('links /enquire from the homepage', () => {
    expect(links('app/(marketing)/page.tsx', '/enquire')).toBe(true);
  });

  it('links /apply from the page about working here', () => {
    expect(
      links('app/(marketing)/for-providers/page.tsx', '/apply'),
      '/for-providers explained how referrals work and offered no way to apply',
    ).toBe(true);
  });

  it('links /refer from the page about referring', () => {
    expect(
      links('app/(marketing)/for-partners/page.tsx', '/refer'),
      '/refer was only linked from inside the partner portal',
    ).toBe(true);
  });

  it('puts all three at the foot of every marketing page, from the layout', () => {
    const layout = read(join(ROOT, 'app/(marketing)/layout.tsx'));
    expect(layout).toContain('CallToAction');
    const cta = read(join(ROOT, 'components/CallToAction.tsx'));
    for (const href of ['/enquire', '/refer', '/apply']) {
      expect(cta).toContain(href);
    }
  });

  it('carries the care type through from a crossed landing page', () => {
    const crossed = read(join(ROOT, 'app/(marketing)/care/[service]/[area]/page.tsx'));
    expect(crossed, 'the best-targeted traffic on the site arrived with nothing to do')
      .toContain('/enquire?care=');
  });
});

describe('nothing links somewhere that is not there', () => {
  it('every internal marketing link resolves to a route', () => {
    const routes = new Set(marketingRoutes());
    for (const href of allHrefs) {
      if (!href.startsWith('/')) continue;
      const path = href.split('?')[0]!.split('#')[0]!;
      // Portal and dynamic routes live outside app/(marketing).
      if (/^\/(portal|pro|partner|invite|api|login|care|portal-file)\b/.test(path)) continue;
      if (path.includes('${')) continue;
      expect(routes.has(path), `${href} points at no page under app/(marketing)`).toBe(true);
    }
  });
});

describe('the sitemap lists what the site has', () => {
  /*
   * The claim this makes true: a page can be built, linked and shipped, and simply
   * never appear in the sitemap, because the list is written by hand in lib/site.ts
   * and nothing compared it to the filesystem.
   */
  it('names every fixed marketing route', () => {
    const listed = new Set(MARKETING_ROUTES.map((r) => r.path));
    for (const route of marketingRoutes()) {
      expect(listed.has(route), `${route} exists and is not in MARKETING_ROUTES`).toBe(true);
    }
  });

  it('lists nothing that does not exist', () => {
    const actual = new Set(marketingRoutes());
    for (const { path } of MARKETING_ROUTES) {
      expect(actual.has(path), `${path} is listed in the sitemap and has no page`).toBe(true);
    }
  });
});

describe('every public page declares its own canonical URL', () => {
  /*
   * The root layout sets `alternates: { canonical: '/' }` and Next inherits it, so
   * seven of the eight public pages were declaring the HOMEPAGE as their canonical.
   * Invisible while everything is noindex; the day a filed name is configured it
   * collapses the marketing site to one indexable URL.
   *
   * `publicMetadata` now takes the path as a required argument, so this asserts the
   * path each page passes is its own route rather than that it passed one at all.
   */
  it('passes its own route to publicMetadata', () => {
    const base = join(ROOT, 'app/(marketing)');
    for (const file of filesUnder(base, /^page\.tsx$/)) {
      const route = file.replace(base, '').replace(/\/page\.tsx$/, '') || '/';
      const src = read(file);
      if (route.includes('[')) {
        // The crossed pages compute theirs from the content they render.
        expect(src).toContain('crossedPath(page)');
        continue;
      }
      expect(src, `${route} sets metadata without publicMetadata`).toContain('publicMetadata');
      expect(
        src.includes(`}, '${route}');`),
        `${route} does not pass its own path to publicMetadata`,
      ).toBe(true);
    }
  });
});
