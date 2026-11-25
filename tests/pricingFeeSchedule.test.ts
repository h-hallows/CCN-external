/**
 * /pricing — that it says something, and that nothing it says was made up here.
 *
 * THE DEFECT THIS FILE IS ABOUT. The page rendered a heading, two paragraphs about who
 * sets the rate, and — in the state it is actually in, with no band posted by anybody —
 * an empty section followed by a caption describing a table that was not there. It is
 * listed at priority 0.9 in the sitemap, it is one of five links in the header, and
 * § 1812.527 requires a nurses' registry to post its schedule of fees, so an empty
 * pricing page is a commercial gap and a statutory one at the same time.
 *
 * WHY THE ASSERTIONS ARE MOSTLY RENDERED ONES. A source assertion can only say that a
 * string is in the file. The two things worth knowing about this page are what a visitor
 * is shown when nothing has been posted, and what they are shown when something has —
 * and the caption defect lived exactly in the difference between those two. So the page
 * is rendered in both states, and in the two states of the figures the operator has to
 * supply.
 *
 * WHAT IS NOT TESTED HERE, BECAUSE IT IS NOT BUILT. The page does not read
 * `fee_schedules`. That table is FORCE ROW LEVEL SECURITY with two policies — the
 * operator, and a provider it was delivered to — so a public page reads nothing from it,
 * and lib/feeSchedule.ts records why plumbing one in would be the wrong fix. What the
 * page publishes instead is configuration, and the assertions below are about the state
 * where nobody has configured it, which is the state the repository is in.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DbHandle } from '@h-hallows/core/db';
import { seededDb } from '@h-hallows/core/testing';
import Pricing from '@/app/(marketing)/pricing/page';
import { EMBARGO_DAYS, feeCommitments, unfilledFeeCommitments } from '@/lib/feeSchedule';

/*
 * The page's JSX compiles to `React.createElement` here, and nothing in the application
 * imports React because Next provides it: `tsconfig.json` sets `jsx: "preserve"`, so
 * the transform vitest uses falls back to the classic runtime. Rendering a page outside
 * Next means supplying what Next would have. One line, in the only file that renders a
 * page, rather than a change to the shared configuration.
 */
(globalThis as unknown as { React: typeof React }).React = React;

const ROOT = new URL('..', import.meta.url).pathname;
const PAGE = join(ROOT, 'app/(marketing)/pricing/page.tsx');
const source = readFileSync(PAGE, 'utf8');
/** Comments may quote a figure to explain a rule; the page itself may not contain one. */
const pageCode = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

const render = async () => renderToStaticMarkup(await Pricing());

let db: DbHandle;
/** Nothing posted by anybody: the seed's own bands are excluded by the query. */
let nothingPosted = '';
/** One band posted by an operator, one future-dated, one left to the seed. */
let bandPosted = '';

beforeAll(async () => {
  db = await seededDb();
  nothingPosted = await render();

  await db.query(
    `INSERT INTO rate_ranges
       (service_key, credential_level, low, high, effective_from, posted_at, posted_by)
     VALUES ('respite', 'cna', 31, 37, current_date - 1, now(), 'an operator')`);
  /*
   * Posted and not yet in force. The same shape as the fee schedule's seven-day
   * embargo: a band whose date has not arrived is a decision taken, not a price anybody
   * may be quoted, and the page showing it as current would be the § 1812.527 problem
   * in miniature on the public side.
   */
  await db.query(
    `INSERT INTO rate_ranges
       (service_key, credential_level, low, high, effective_from, posted_at, posted_by)
     VALUES ('hospice_support', 'rn', 91, 97, current_date + 30, now(), 'an operator')`);
  bandPosted = await render();
});

describe('the page posts what the law and a household both want', () => {
  it('says what the fee is and who it is charged to', () => {
    expect(nothingPosted).toContain('percentage of the cost of the engagement');
    expect(nothingPosted).toContain('charged to the household');
  });

  it('says that a provider is never charged, which § 1812.530 makes absolute', () => {
    expect(nothingPosted).toMatch(/no charge to a provider of any kind/);
    expect(nothingPosted).toMatch(/never charged/);
    expect(nothingPosted).toContain('registration fee');
  });

  it('explains the posted schedule and its notice period, from one constant', () => {
    expect(nothingPosted).toContain(`${EMBARGO_DAYS} days`);
    // The number is EMBARGO_DAYS' to state. A page that spells it out in words is one
    // that goes on saying seven after the statute or the constant has moved.
    expect(pageCode).toContain('EMBARGO_DAYS');
    expect(pageCode).not.toMatch(/seven days/i);
  });

  it('tells a household how to get the schedule as it stands', () => {
    expect(nothingPosted).toMatch(/ask us/i);
  });
});

describe('no figure on this page was invented here', () => {
  it('the source carries no rate and no percentage', () => {
    // The same rule tests/marketing.test.ts applies to every page, asserted again at
    // the one page where a plausible number would be most welcome and least checkable.
    expect(pageCode).not.toMatch(/\$\s?\d/);
    expect(pageCode).not.toMatch(/\d+(\.\d+)?\s?%/);
  });

  it('reads no variable of its own: every supplied figure arrives as a commitment', () => {
    // A page reading process.env directly is a page where the next figure is added
    // without a placeholder, without a name for who supplies it, and without this test
    // seeing it.
    expect(pageCode).not.toContain('process.env');
    expect(pageCode).toContain('feeCommitments');
  });

  it('nobody has guessed one in the repository as it stands', () => {
    for (const c of feeCommitments()) {
      expect(c.env.startsWith('NEXT_PUBLIC_'), c.env).toBe(true);
      expect(c.needs.length, c.env).toBeGreaterThan(20);
      expect(c.who.length, c.env).toBeGreaterThan(5);
    }
    expect(unfilledFeeCommitments().length).toBe(feeCommitments().length);
  });

  it('prints every unfilled figure as a marked gap, naming the variable and who fills it', () => {
    for (const c of unfilledFeeCommitments()) {
      expect(nothingPosted, `${c.env} is missing and the page does not say so`)
        .toContain(`data-unfilled="${c.id}"`);
      expect(nothingPosted).toContain(c.env);
      expect(nothingPosted).toContain(c.who);
    }
  });

  it('prints the figure instead, and no gap, once somebody supplies one', async () => {
    const { env } = feeCommitments()[0]!;
    const before = process.env[env];
    process.env[env] = 'a tenth of the cost of the engagement';
    try {
      const html = await render();
      expect(html).toContain('a tenth of the cost of the engagement');
      expect(html).not.toContain(`data-unfilled="${feeCommitments()[0]!.id}"`);
      // And the other one is still a gap, so a page half filled in says which half.
      expect(unfilledFeeCommitments().length).toBe(feeCommitments().length - 1);
      expect(html).toContain(`data-unfilled="${feeCommitments()[1]!.id}"`);
    } finally {
      if (before === undefined) delete process.env[env];
      else process.env[env] = before;
    }
  });
});

describe('the caption belongs to the table', () => {
  const CAPTION = 'Updated from our own roster';

  it('is not rendered when there is no table under it', () => {
    // The defect, stated as the rule it broke. A caption describing absent content tells
    // the reader something was meant to be here and does not say what.
    expect(nothingPosted).not.toContain(CAPTION);
    expect(nothingPosted).not.toContain('<table');
  });

  it('is rendered with it', () => {
    expect(bandPosted).toContain('<table');
    expect(bandPosted).toContain(CAPTION);
  });

  it('says which empty state it is in rather than one sentence for both', () => {
    expect(nothingPosted).toContain('No ranges are posted at the moment');
  });
});

describe('a band is published only once it is somebody\'s and in force', () => {
  it('shows one an operator posted', () => {
    expect(bandPosted).toContain('Respite');
    expect(bandPosted).toMatch(/31.{0,20}37/);
  });

  it('never shows one whose date has not arrived', () => {
    // Posted, not in force. The row exists and names an operator, so this fails if the
    // page ever renders what has merely been decided.
    expect(bandPosted).not.toContain('Hospice support');
    expect(bandPosted).not.toMatch(/91.{0,20}97/);
  });

  it('never shows one the seed wrote, which nobody at this registry posted', async () => {
    const [seeded] = await db.query<{ service_key: string; low: string; high: string }>(
      `SELECT service_key, low::text, high::text FROM rate_ranges
        WHERE posted_by = 'seed' AND effective_from <= current_date LIMIT 1`);
    expect(seeded, 'the fixture has no seeded band to be excluded').toBeTruthy();
    const low = Number(seeded!.low).toFixed(0);
    const high = Number(seeded!.high).toFixed(0);
    expect(bandPosted).not.toContain(`$${low}–$${high} an hour`);
  });
});

describe('the page is withheld with the rest of the site', () => {
  it('composes its metadata through publicMetadata, with its own canonical', () => {
    // § 1812.533(b)(2): a meta description is advertising copy, and the brand states
    // where the site is deliberately unpublished withhold it. A page that builds its
    // own metadata object is a page that keeps advertising after the body stops.
    expect(pageCode).toContain('publicMetadata(');
    expect(pageCode).toContain("}, '/pricing');");
  });

  it('still renders nothing that needs a business name', () => {
    expect(nothingPosted).not.toContain('PENDING');
  });
});
