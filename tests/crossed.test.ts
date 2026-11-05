/**
 * W10 — the service × area pages. Web build spec § 5 and § 11.
 *
 * § 5 states the gate as a minimum: "at least two items in localContext, two in
 * commonCases and three questions or the build fails that page. That gate is what
 * stops templated filler."
 *
 * A minimum does not stop templated filler on its own. Ten pages can each have their
 * two items and be the same two items with the place name swapped, which is precisely
 * the thing the rule is aimed at and precisely the thing a count cannot see. So the
 * minimum is asserted here because the spec requires it, and then the assertion that
 * actually does the work is further down: no sentence appears on two pages.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CROSSED_PAGES, MIN_COMMON_CASES, MIN_LOCAL_CONTEXT, MIN_QUESTIONS, MONEY,
  crossedPage,
} from '@/content/crossed';
import { assertComplete, type CrossedPage } from '@/content/crossed/types';
import { crossedPath, faqJsonLd } from '@/lib/crossed';
import { ROOT } from './importGraph';

const CONTENT_DIR = path.join(ROOT, 'content', 'crossed');

function complete(overrides: Partial<CrossedPage> = {}): CrossedPage {
  return {
    service: 'test-service',
    area: 'test-area',
    title: 'A Test Page',
    summary: 'A summary that is comfortably under the limit for a meta description.',
    localContext: [
      'The first thing that is true about care in this particular place and nowhere else.',
      'The second thing that is true about care in this particular place and nowhere else.',
    ],
    commonCases: [
      'The first situation that actually arrives from this area with some regularity.',
      'The second situation that actually arrives from this area with some regularity.',
    ],
    questions: [
      { q: 'The first question?', a: 'An answer long enough to be a real answer to it.' },
      { q: 'The second question?', a: 'An answer long enough to be a real answer to it.' },
      { q: 'The third question?', a: 'An answer long enough to be a real answer to it.' },
    ],
    rateKey: 'companion',
    reviewedOn: '2026-11-05',
    body: ['A paragraph of body copy that says something rather than nothing at all.'],
    ...overrides,
  };
}

describe('there are ten pages and they resolve', () => {
  it('ships at least the ten the spec asks for', () => {
    expect(CROSSED_PAGES.length).toBeGreaterThanOrEqual(10);
  });

  it('has a file on disk for every page, and a page for every file', () => {
    const files = readdirSync(CONTENT_DIR)
      .filter((f) => f.endsWith('.ts') && f !== 'index.ts' && f !== 'types.ts')
      .map((f) => f.replace(/\.ts$/, ''))
      .sort();
    const fromPages = CROSSED_PAGES.map((p) => `${p.service}--${p.area}`).sort();
    // A file nobody imports is a page that silently does not exist — and, because the
    // gate runs at import, one that was never checked either.
    expect(files).toEqual(fromPages);
  });

  it('resolves each one by its own path, and nothing else', () => {
    for (const page of CROSSED_PAGES) {
      expect(crossedPage(page.service, page.area)).toBe(page);
      expect(crossedPath(page)).toBe(`/care/${page.service}/${page.area}`);
    }
    expect(crossedPage('no-such-service', 'no-such-area')).toBeNull();
  });
});

describe('the § 5 minimums', () => {
  it('every page meets them', () => {
    for (const page of CROSSED_PAGES) {
      const where = `${page.service}--${page.area}`;
      expect(page.localContext.length, `${where} localContext`)
        .toBeGreaterThanOrEqual(MIN_LOCAL_CONTEXT);
      expect(page.commonCases.length, `${where} commonCases`)
        .toBeGreaterThanOrEqual(MIN_COMMON_CASES);
      expect(page.questions.length, `${where} questions`)
        .toBeGreaterThanOrEqual(MIN_QUESTIONS);
      expect(page.summary.length, `${where} summary`).toBeLessThanOrEqual(160);
      // The same 60-character title limit the static marketing pages are held to.
      // These set their title through generateMetadata, so that test cannot see them.
      expect(page.title.length, `${where} title`).toBeLessThanOrEqual(60);
    }
  });

  it('revalidates on the hour, matching the rates module', async () => {
    // Next parses segment config statically and rejects an imported constant, so the
    // route hardcodes 3600. This is what keeps the two from drifting apart.
    const { RATE_REVALIDATE_SECONDS } = await import('@/lib/rates');
    const route = readFileSync(
      path.join(ROOT, 'app/(marketing)/care/[service]/[area]/page.tsx'), 'utf8');
    const declared = /export const revalidate = (\d+)/.exec(route);
    expect(declared, 'the route declares no revalidate').not.toBeNull();
    expect(Number(declared![1])).toBe(RATE_REVALIDATE_SECONDS);
  });

  it('the gate actually rejects a short page, rather than being decorative', () => {
    // Proving the negative assertion has teeth. Without this, a broken
    // assertComplete would let every test above pass against pages it never checked.
    expect(() => assertComplete(complete({ localContext: ['Only one thing here, which is not enough.'] })))
      .toThrow(/localContext/);
    expect(() => assertComplete(complete({ commonCases: ['Only one case here, which is not enough.'] })))
      .toThrow(/commonCases/);
    expect(() => assertComplete(complete({
      questions: [
        { q: 'Only two?', a: 'An answer long enough to be a real answer to it.' },
        { q: 'Still two?', a: 'An answer long enough to be a real answer to it.' },
      ],
    }))).toThrow(/questions/);
    expect(() => assertComplete(complete({ summary: 'x'.repeat(161) })))
      .toThrow(/summary/);
    expect(() => assertComplete(complete({ body: [] }))).toThrow(/body/);
  });

  it('rejects a heading with nothing under it', () => {
    // The shape filler takes once a minimum exists: the right number of items, each
    // of them three words long.
    expect(() => assertComplete(complete({ localContext: ['Close to hospitals', 'Easy parking'] })))
      .toThrow(/too short/);
    expect(() => assertComplete(complete({
      questions: [
        { q: 'A proper question here?', a: 'Yes.' },
        { q: 'The second question?', a: 'An answer long enough to be a real answer to it.' },
        { q: 'The third question?', a: 'An answer long enough to be a real answer to it.' },
      ],
    }))).toThrow(/does not answer it/);
  });
});

describe('no page names a rate', () => {
  it('not in any field of any page', () => {
    for (const page of CROSSED_PAGES) {
      const everything = [
        page.title, page.summary, ...page.localContext, ...page.commonCases,
        ...page.body, ...page.questions.flatMap((q) => [q.q, q.a]),
      ].join('\n');
      const money = MONEY.exec(everything);
      expect(money, `${page.service}--${page.area} names "${money?.[0]}"`).toBeNull();
    }
  });

  it('the gate rejects one that does', () => {
    expect(() => assertComplete(complete({
      body: ['Our companions typically charge $35 an hour, which is competitive.'],
    }))).toThrow(/names a rate/);
  });

  it('the rate comes from the table instead', () => {
    // Every page's rateKey has to resolve against something the operator maintains,
    // or the section renders its empty state forever and nobody finds out.
    const known = new Set([
      'companion', 'personal_care', 'skilled_nursing', 'post_surgical',
      'overnight_newborn', 'respite', 'hospice_support',
    ]);
    for (const page of CROSSED_PAGES) {
      expect(known.has(page.rateKey), `${page.service} has rateKey "${page.rateKey}"`)
        .toBe(true);
    }
  });
});

describe('nothing is templated', () => {
  /**
   * The assertion the § 5 minimum cannot make.
   *
   * Ten pages can each hit their minimum and still be one page with the place name
   * swapped ten times. Google treats that as doorway content and so would any reader.
   * So: no sentence from localContext, commonCases, body or an answer may appear on
   * two pages.
   */
  function sentences(page: CrossedPage): { field: string; text: string }[] {
    return [
      ...page.localContext.map((text) => ({ field: 'localContext', text })),
      ...page.commonCases.map((text) => ({ field: 'commonCases', text })),
      ...page.body.map((text) => ({ field: 'body', text })),
      ...page.questions.map((q) => ({ field: 'answer', text: q.a })),
    ];
  }

  it('shares no sentence between any two pages', () => {
    const seen = new Map<string, string>();
    for (const page of CROSSED_PAGES) {
      const where = `${page.service}--${page.area}`;
      for (const { field, text } of sentences(page)) {
        const key = text.trim().toLowerCase();
        const first = seen.get(key);
        expect(
          first,
          `${where} repeats a ${field} sentence from ${first}`,
        ).toBeUndefined();
        seen.set(key, where);
      }
    }
  });

  it('shares no summary or title', () => {
    expect(new Set(CROSSED_PAGES.map((p) => p.summary)).size).toBe(CROSSED_PAGES.length);
    expect(new Set(CROSSED_PAGES.map((p) => p.title)).size).toBe(CROSSED_PAGES.length);
  });

  it('names its own area somewhere a reader would notice', () => {
    for (const page of CROSSED_PAGES) {
      const words = page.area.split('-');
      const prose = [page.title, ...page.localContext].join(' ').toLowerCase();
      expect(
        words.some((w) => prose.includes(w)),
        `${page.service}--${page.area} never mentions where it is`,
      ).toBe(true);
    }
  });
});

describe('structured data stays inside § 8', () => {
  const BANNED_TYPES = [
    'MedicalBusiness', 'HomeHealthCareService', 'Physician', 'Hospital',
    'MedicalClinic', 'MedicalOrganization',
  ];

  it('emits FAQPage and Question, and none of the forbidden types', () => {
    for (const page of CROSSED_PAGES) {
      const json = JSON.stringify(faqJsonLd(page));
      expect(json).toContain('"FAQPage"');
      for (const type of BANNED_TYPES) {
        expect(json, `${page.service} claims ${type}`).not.toContain(`"${type}"`);
      }
      expect(json).not.toContain('aggregateRating');
    }
  });

  it('the route file itself claims none of them either', () => {
    const route = readFileSync(
      path.join(ROOT, 'app/(marketing)/care/[service]/[area]/page.tsx'), 'utf8');
    for (const type of BANNED_TYPES) {
      expect(route, `the route claims ${type}`).not.toContain(`'${type}'`);
    }
    expect(route).not.toContain('aggregateRating');
  });
});
