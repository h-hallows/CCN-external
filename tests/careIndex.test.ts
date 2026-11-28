/**
 * THE TEN PAGES NOTHING LINKED TO, AND THE RULES THAT KEEP IT THAT WAY NO LONGER.
 *
 * `/care/<service>/<area>` shipped ten hand-written pages at W10: each with its own
 * local detail, its own cases, its own questions, a live rate table and FAQ structured
 * data. `tests/crossed.test.ts` asserts all of that, and asserted it green the whole
 * time — because not one link anywhere in the application pointed at any of them. They
 * were in the sitemap and nowhere else. A reader who landed on the Beverly Hills page
 * could not find the Santa Monica one; a reader who came through the front door could
 * not find either.
 *
 * That is this repository's signature failure in its public form, and the third time it
 * has been found here: the console's five dead mechanisms, the three intake routes with
 * no form on the front of them, and now ten pages with nothing leading in. Every one of
 * those surfaces was correct, tested and green. The question nobody was asking is the one
 * `tests/doors.test.ts` is built around and this file continues — for every path, who
 * reaches it.
 *
 * So the rules below are about reachability and about the one crossing it rests on.
 * Nothing here re-checks the content of a curated page; that is the other file's job.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CROSSED_PAGES } from '@/content/crossed';
import {
  areaSlug, areaValue, asArea, asCareType, careDestination, crossedPath, curatedPage,
  pagesForCare, pagesInArea,
} from '@/lib/crossed';
import { AREAS, CARE_TYPES } from '@/lib/schemas/intake';
import { MARKETING_ROUTES } from '@/lib/site';
import { ROOT, code, walk } from './importGraph';

const read = (p: string) => readFileSync(p, 'utf8');

/*
 * Source with its comments removed, for every rule below that reads markup.
 *
 * THE FIFTH TIME A SCAN IN THIS CODEBASE WOULD HAVE READ A COMMENT AS CODE. The page
 * this file is about carries a docblock explaining why the picker is a `method="get"`
 * form and why the chips became links, and it quotes `/care?area=` and `href` in doing
 * so. A scan that counted those would report the whole mechanism present on a site where
 * none of it had been written. `tests/importGraph.ts` exports the stripper; every file
 * that greps source now uses it rather than writing a fourth copy.
 */
const sourceFiles = [
  ...walk(join(ROOT, 'app')),
  ...walk(join(ROOT, 'components')),
];

describe('two slug systems, crossed in exactly one place', () => {
  /*
   * The ten pages spell a place `beverly-hills` because that is a URL segment a search
   * engine reads. Every enum, form and database row says `beverly_hills`. Both are
   * right and neither can move — the first is published, the second is what core
   * stores — so the only question is whether anything joins them, and for ten pages the
   * answer was no.
   */
  it('every area value becomes a slug and comes back unchanged', () => {
    for (const area of AREAS) {
      expect(areaValue(areaSlug(area)), `${area} does not round-trip`).toBe(area);
    }
  });

  it('every curated page names a place the forms also offer', () => {
    const slugs = new Set(AREAS.map(areaSlug));
    for (const page of CROSSED_PAGES) {
      expect(
        slugs.has(page.area),
        `/care/${page.service}/${page.area} is about a place no form offers, so nothing `
        + 'on the site can route to it and no enquiry from it can be filed',
      ).toBe(true);
    }
  });

  it('every curated page names a service the forms also offer, through its rateKey', () => {
    /*
     * `rateKey` was already the service half of the crossing and was not being used for
     * it: it is the same string the forms post, because it resolves against
     * `rate_ranges`. That is why there is no service slug table in lib/crossed.ts — and
     * this is what stops one being needed later.
     */
    for (const page of CROSSED_PAGES) {
      expect(
        (CARE_TYPES as readonly string[]).includes(page.rateKey),
        `/care/${page.service}/${page.area} has rateKey "${page.rateKey}", which is not a `
        + 'care type any form offers',
      ).toBe(true);
    }
  });

  it('refuses anything that did not come off those two lists', () => {
    // The picker submits into a query string, and a query string is whatever somebody
    // typed. Both answers are validated before either reaches `careDestination`.
    expect(asArea('santa_monica')).toBe('santa_monica');
    expect(asArea('santa-monica')).toBeNull();
    expect(asArea('../../etc/passwd')).toBeNull();
    expect(asArea(undefined)).toBeNull();
    expect(asArea(['santa_monica'])).toBeNull();
    expect(asCareType('post_surgical')).toBe('post_surgical');
    expect(asCareType('post-surgical-recovery')).toBeNull();
    expect(asCareType('https://example.com')).toBeNull();
  });
});

describe('every one of the ten can be arrived at by answering the two questions', () => {
  it('resolves each page from the pair a visitor would have chosen', () => {
    for (const page of CROSSED_PAGES) {
      const area = asArea(areaValue(page.area));
      const care = asCareType(page.rateKey);
      expect(area, `${page.area} is not an area a visitor can choose`).not.toBeNull();
      expect(care, `${page.rateKey} is not a care type a visitor can choose`).not.toBeNull();
      expect(curatedPage(care!, area!)).toBe(page);
      expect(
        careDestination(care!, area!),
        `nothing a visitor can answer leads to /care/${page.service}/${page.area}`,
      ).toBe(crossedPath(page));
    }
  });

  it('reaches all ten and not merely some of them', () => {
    const reached = new Set(
      CROSSED_PAGES.map((page) => careDestination(
        asCareType(page.rateKey)!, asArea(areaValue(page.area))!,
      )),
    );
    expect(reached.size).toBe(CROSSED_PAGES.length);
    expect(reached.size).toBeGreaterThanOrEqual(10);
  });

  it('sends the other sixty pairs to the form with both answers in it', () => {
    /*
     * Seven services by ten places is seventy pairs and ten pages exist, so this branch
     * is the one six visitors in seven take. It is not a fallback: an enquiry is what
     * the business wants from the ten as well, and arriving at the form with both
     * questions answered is a better outcome than a page that does not exist.
     */
    let withoutPage = 0;
    for (const care of CARE_TYPES) {
      for (const area of AREAS) {
        const destination = careDestination(care, area);
        if (curatedPage(care, area)) {
          expect(destination).toMatch(/^\/care\/[a-z-]+\/[a-z-]+$/);
          continue;
        }
        withoutPage += 1;
        expect(
          destination,
          `${care} in ${area} has no page and does not carry both answers to the form`,
        ).toBe(`/enquire?care=${care}&area=${area}`);
      }
    }
    // 8 care types (not_sure included) x 10 areas, minus the ten that have a page.
    expect(withoutPage).toBe(CARE_TYPES.length * AREAS.length - CROSSED_PAGES.length);
  });

  it('`other` and `not_sure` are real answers and go to the form', () => {
    // Neither can have a page. `not_sure` is the most honest answer somebody has at four
    // on a Friday and `other` is a place we have written nothing about by definition.
    expect(careDestination('not_sure', 'century_city'))
      .toBe('/enquire?care=not_sure&area=century_city');
    expect(careDestination('skilled_nursing', 'other'))
      .toBe('/enquire?care=skilled_nursing&area=other');
  });

  it('the two filters agree with the pages themselves', () => {
    for (const area of AREAS) {
      for (const page of pagesInArea(area)) expect(page.area).toBe(areaSlug(area));
    }
    for (const care of CARE_TYPES) {
      for (const page of pagesForCare(care)) expect(page.rateKey).toBe(care);
    }
    const counted = AREAS.reduce((n, area) => n + pagesInArea(area).length, 0);
    expect(counted, 'a page belongs to no area any filter can find').toBe(CROSSED_PAGES.length);
  });
});

describe('the question can be answered without JavaScript', () => {
  const picker = code(join(ROOT, 'app/(marketing)/care/page.tsx'));

  /*
   * The three intake forms in this repository were `<form onSubmit>` with no `action`
   * and no `method` until somebody pressed one with JavaScript off and watched a
   * household's telephone number go into the URL bar. A picker built the same way would
   * simply have been a button that did nothing. So this is asserted at the markup, not
   * reasoned about from the component being a server one.
   */
  it('is a GET form that submits to the route that answers it', () => {
    expect(picker).toMatch(/<form[^>]*method="get"/);
    expect(picker).toMatch(/<form[^>]*action="\/care"/);
    expect(picker, 'the picker runs on a click handler, so it needs a hydrated bundle')
      .not.toMatch(/onSubmit|onChange|onClick/);
    expect(picker, 'a picker on a page that says "use client" is not this mechanism')
      .not.toContain("'use client'");
  });

  it('names its two fields what the route reads', () => {
    for (const field of ['care', 'area']) {
      expect(picker, `the picker has no field called ${field}`)
        .toMatch(new RegExp(`name="${field}"`));
      expect(picker, `nothing labels the ${field} field`)
        .toMatch(new RegExp(`htmlFor="${field}"`));
    }
    expect(picker, 'the route does not read what the form sends').toContain('params.care');
    expect(picker).toContain('params.area');
  });

  it('validates both before redirecting anywhere', () => {
    // `redirect` takes whatever string it is handed. Were either answer passed through
    // unvalidated, `/care?area=https://elsewhere` would be an open redirect on the one
    // page built to be arrived at from a search engine.
    expect(picker).toMatch(/asCareType\(params\.care\)/);
    expect(picker).toMatch(/asArea\(params\.area\)/);
    const at = picker.indexOf('redirect(');
    expect(at, 'the page does not redirect at all').toBeGreaterThan(0);
    expect(picker.slice(at), 'redirect is handed something other than careDestination')
      .toMatch(/^redirect\(careDestination\(care, area\)\)/);
  });
});

describe('no marketing route is reachable only from the sitemap', () => {
  /*
   * THE RULE, RATHER THAN THE INSTANCE. `/care` is linked now; so was `/refer`, from two
   * places, both of them inside a portal that needs an invite. What was missing was
   * anything that would notice. Every fixed route the sitemap advertises has to be
   * linked from a page that is not itself — a sitemap entry is how a crawler finds a
   * page and is not how a person does.
   */
  const hrefs = new Map<string, Set<string>>();
  for (const file of sourceFiles) {
    if (!file.endsWith('.tsx')) continue;
    /*
     * `href=` IS NOT WHERE THE HEADER'S LINKS ARE WRITTEN, which this rule found on the
     * first run by reporting `/for-partners` unlinked. It is in the layout's `NAV`, as
     * five object literals rendered through `href={item.href}` — and `CallToAction`'s
     * three doors are the same shape. An attribute scan sees neither, so a rule about
     * reachability built on one would have called the most prominent navigation on the
     * site absent and the two genuinely orphaned pages present. Both forms count.
     */
    const src = code(file);
    const found = [
      ...src.matchAll(/href=(?:"([^"]+)"|\{`([^`]+)`\}|\{'([^']+)'\})/g),
      ...src.matchAll(/\bhref:\s*(?:'([^']+)'|"([^"]+)"|`([^`]+)`)/g),
    ];
    for (const m of found) {
      const href = (m[1] ?? m[2] ?? m[3])!;
      const path = href.split('?')[0]!.split('#')[0]!;
      if (!path.startsWith('/')) continue;
      if (!hrefs.has(path)) hrefs.set(path, new Set());
      hrefs.get(path)!.add(file);
    }
  }

  it('found links at all, so a clean pass is not an empty walk', () => {
    expect(hrefs.size).toBeGreaterThan(10);
    expect(sourceFiles.length).toBeGreaterThan(30);
  });

  for (const { path } of MARKETING_ROUTES) {
    it(`${path} is linked from somewhere a person could be standing`, () => {
      const from = [...hrefs.get(path) ?? []]
        .filter((file) => !file.endsWith(`app/(marketing)${path === '/' ? '' : path}/page.tsx`));
      expect(
        from.length,
        `${path} is in MARKETING_ROUTES and no page links to it. A crawler can find it `
        + 'and a reader cannot.',
      ).toBeGreaterThan(0);
    });
  }
});
