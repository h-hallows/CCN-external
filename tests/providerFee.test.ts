/**
 * § 1812.530 — a nurses' registry may not charge a fee to the nurse — asserted as a
 * rule over the provider portal rather than by reading today's pages.
 *
 * WHY A RULE. The statute is not about a sentence being present somewhere. It is about
 * there being no screen on which a nurse is shown, implied or asked for a fee. A test
 * that checks /pro/rate says the right thing is a test about /pro/rate, and § 1812.530
 * is broken by the screen nobody thought to check.
 *
 * So there are three assertions and they are all about the TREE:
 *
 *   1. no provider-facing surface collects anything, or offers a control that would;
 *   2. no provider-facing surface says a fee is taken from, deducted from, owed by or
 *      conditional on the provider;
 *   3. every provider-facing surface that puts a fee FIGURE in front of a nurse also
 *      says, in the one shared wording, who the fee is charged to.
 *
 * (3) is the one that found something. /pro/fee-schedule printed the reassurance in
 * the branch for a CNA — who has no posted schedule and no figure — and said nothing
 * about who pays in the branch that renders "35% maximum" and a set of payment terms
 * to a registered nurse. See the note on NO_FEE_TO_YOU in lib/proState.ts.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as ReactRuntime from 'react';
import type { DbHandle } from '@h-hallows/core/db';
import { seededDb } from '@h-hallows/core/testing';
import { ROOT, code, rel } from './importGraph';
import { NO_FEE_TO_YOU } from '@/lib/proState';

// Classic JSX runtime: see the note in tests/portalDoors.test.ts.
(globalThis as { React?: unknown }).React = ReactRuntime;

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k) } : undefined),
    set: (k: string, v: string) => { jar.set(k, v); },
    delete: (k: string) => { jar.delete(k); },
  }),
  headers: async () => new Headers({ host: 'localhost:3003' }),
}));

const TOKEN = 'provider-fee-token';

function walkAll(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkAll(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Everything under the provider tree, plus the modules only it reads. */
const PROVIDER_SOURCE = [
  ...walkAll(path.join(ROOT, 'app/(provider)')),
  path.join(ROOT, 'lib/pro.ts'),
  path.join(ROOT, 'lib/proState.ts'),
  path.join(ROOT, 'lib/feeSchedule.ts'),
  path.join(ROOT, 'lib/opportunities.ts'),
];

/** The pages a provider can actually open. */
const PROVIDER_PAGES = walkAll(path.join(ROOT, 'app/(provider)'))
  .filter((f) => /\/page\.tsx$/.test(f))
  .sort();

let db: DbHandle;
let nurseScheduleVersion = 0;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const [row] = await db.query<T>(sql, params);
  if (!row) throw new Error(`fixture query returned no rows: ${sql}`);
  return row;
}

function stringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === 'object' && v !== null) {
      if (seen.has(v as object)) return '[circular]';
      seen.add(v as object);
    }
    return typeof v === 'function' ? '[fn]' : v;
  }) ?? '';
}

async function render(file: string): Promise<string> {
  const mod = await import(/* @vite-ignore */ file) as {
    default: (p: unknown) => Promise<unknown>;
  };
  return stringify(await mod.default({
    params: Promise.resolve({}), searchParams: Promise.resolve({}),
  }));
}

beforeAll(async () => {
  db = await seededDb();
  const { hashToken } = await import('@/lib/session');

  /*
   * A registered nurse, because § 1812.527's posted schedule applies to RNs and LVNs
   * and to nobody else — which is exactly why the reassurance ended up on the wrong
   * branch. The fixture has to be the audience the statute is about.
   */
  const nurse = await one<{ id: string }>(
    `SELECT p.id FROM providers p
      WHERE p.type IN ('RN','LVN')
        AND NOT EXISTS (SELECT 1 FROM provider_users u WHERE u.provider_id = p.id)
      ORDER BY p.created_at, p.id LIMIT 1`);

  const user = await one<{ id: string }>(
    `INSERT INTO users (email, display_name, role)
     VALUES ('fee-nurse@example.com', 'A Nurse', 'provider')
     ON CONFLICT (email) DO UPDATE SET role = 'provider' RETURNING id`);
  await db.query(
    `INSERT INTO provider_users (user_id, provider_id) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET provider_id = EXCLUDED.provider_id`,
    [user.id, nurse.id]);
  await db.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '1 day')
     ON CONFLICT (token_hash) DO NOTHING`, [user.id, hashToken(TOKEN)]);

  // A schedule in force, DELIVERED to this nurse — `fee_schedules_provider_select`
  // scopes the screen to what they were actually given, so without the delivery row
  // the page renders its "no schedule yet" state and asserts nothing.
  const next = await one<{ v: string }>(
    `SELECT (coalesce(max(version), 0) + 1)::text AS v FROM fee_schedules`);
  nurseScheduleVersion = Number(next.v);
  const schedule = await one<{ id: string }>(
    `INSERT INTO fee_schedules
       (version, max_fee_pct, payment_terms, body, posted_at, effective_from)
     VALUES ($1, 27.5, 'Invoiced to the household monthly, due in fourteen days.',
             'The registry charges the household and never the provider.',
             now() - interval '30 days',
             (now() AT TIME ZONE 'America/Los_Angeles')::date - 10)
     RETURNING id`, [nurseScheduleVersion]);
  await db.query(
    `INSERT INTO fee_schedule_deliveries
       (schedule_id, provider_id, delivered_at, before_interview, delivered_by)
     VALUES ($1, $2, now() - interval '20 days', true, 'operator')
     ON CONFLICT DO NOTHING`, [schedule.id, nurse.id]);

  jar.set('ccn_portal', TOKEN);
});

// ---------------------------------------------------------------------------
// The enumeration first.
// ---------------------------------------------------------------------------

describe('the provider surface is walked off disk', () => {
  it('finds every page a provider can open', () => {
    expect(PROVIDER_PAGES.length).toBeGreaterThan(8);
    for (const expected of [
      'pro/page.tsx', 'pro/rate/page.tsx', 'pro/fee-schedule/page.tsx',
      'pro/documents/page.tsx',
    ]) {
      expect(
        PROVIDER_PAGES.some((f) => rel(f).endsWith(expected)),
        `${expected} is not in the walk`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 1. Nothing collects.
// ---------------------------------------------------------------------------

describe('no provider surface collects money, or offers a control that would', () => {
  /**
   * Input NAMES and payment machinery, not prose. A page may discuss a fee — the
   * statute requires a nurse to be given the schedule — and may not have a field,
   * a processor or an amount due on it.
   */
  const COLLECTION = [
    /name=["'`](card|cardNumber|cvc|cvv|expiry|iban|routing|account(Number)?|amount|price|tip)["'`]/i,
    /\b(stripe|paypal|braintree|checkout\.session|payment_?intent|setup_?intent)\b/i,
    /\b(pay now|pay us|add a card|billing details|card details|enter your card)\b/i,
    /\b(subscription|subscribe|membership fee|joining fee|monthly dues|annual dues)\b/i,
  ];

  it.each(PROVIDER_SOURCE.map((f) => [rel(f), f] as const))('%s', (name, file) => {
    const src = code(file);
    for (const pattern of COLLECTION) {
      expect(
        pattern.test(src),
        `${name} matches ${pattern} — § 1812.530: a nurse is never charged a fee, so `
        + 'there is nothing on this surface to collect one with.',
      ).toBe(false);
    }
  });

  it('and the pattern list is not inert — it catches what it is written for', () => {
    const fake = 'const f = <input name="cardNumber" />; await stripe.charge(amount);';
    expect(COLLECTION.some((p) => p.test(fake))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Nothing says a fee comes out of the provider.
// ---------------------------------------------------------------------------

describe('no provider surface says a fee is taken from the provider', () => {
  /**
   * Phrasings that describe the fee as the nurse's, as opposed to the household's.
   *
   * `NO_FEE_TO_YOU` is excluded from the text being scanned, because it necessarily
   * contains the words it exists to deny — "never charged a fee", "taken out of what
   * you are paid". Scanning the denial as though it were a claim is how a rule like
   * this ends up either vacuous or impossible to satisfy.
   */
  const IMPLIES_A_CHARGE = [
    /\b(deducted|withheld|taken) from (your|what you|the provider)/i,
    /\bwe (take|keep|retain) (a|our) (share|cut|percentage) of (your|what)/i,
    /\byour (fee|commission|placement fee) (is|of)\b/i,
    /\byou (pay|owe|are charged|will be charged|are billed)\b/i,
    /\bcomes out of your\b/i,
  ];

  it.each(PROVIDER_SOURCE.map((f) => [rel(f), f] as const))('%s', (name, file) => {
    const src = code(file).split(NO_FEE_TO_YOU).join(' ');
    for (const pattern of IMPLIES_A_CHARGE) {
      expect(
        pattern.test(src),
        `${name} matches ${pattern} — § 1812.530 forbids a fee to the nurse, so no `
        + 'provider-facing wording may describe one.',
      ).toBe(false);
    }
  });

  it('and these patterns catch the wording they are written for', () => {
    for (const bad of [
      'Our fee is deducted from your hourly rate.',
      'We keep a share of what you are paid.',
      'You pay a placement fee once the engagement starts.',
      'Our percentage comes out of your hours.',
    ]) {
      expect(
        IMPLIES_A_CHARGE.some((p) => p.test(bad)),
        `nothing catches "${bad}"`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Wherever a figure appears, who pays it appears with it.
// ---------------------------------------------------------------------------

describe('a fee figure never reaches a nurse without who it is charged to', () => {
  /** The pages that render a fee figure, found rather than listed. */
  const SHOWS_A_FIGURE = PROVIDER_PAGES.filter(
    (f) => /maxFeePct|feeCommitments|FEE_PCT/.test(code(f)));

  it('finds the pages that put a figure on the screen', () => {
    expect(
      SHOWS_A_FIGURE.map(rel),
      'no provider page renders a fee figure, so this suite is asserting nothing',
    ).not.toEqual([]);
  });

  it.each(SHOWS_A_FIGURE.map((f) => [rel(f), f] as const))(
    '%s renders the shared § 1812.530 wording', (name, file) => {
      expect(
        code(file).includes('NO_FEE_TO_YOU'),
        `${name} shows a fee figure without the § 1812.530 statement. It lives in `
        + 'lib/proState.ts as one string so this rule can be checked against it; '
        + 'retyping it here would pass this test and drift from every other page.',
      ).toBe(true);
    });

  it('the wording itself says the household pays and the provider does not', () => {
    expect(NO_FEE_TO_YOU.toLowerCase()).toContain('charged to the household');
    expect(NO_FEE_TO_YOU.toLowerCase()).toContain('never charged a fee');
    expect(NO_FEE_TO_YOU.toLowerCase()).toContain('what you are paid');
  });

  /**
   * The behavioural half, and the one that found the bug.
   *
   * A nurse with a delivered schedule in force. The page prints the percentage and the
   * payment terms; the question is whether the same render says who pays them.
   */
  it('the nurse branch — the one with the percentage on it — says it', async () => {
    const rendered = await render(path.join(ROOT, 'app/(provider)/pro/fee-schedule/page.tsx'));
    expect(rendered, 'the fixture rendered no schedule, so this asserts nothing')
      .toContain('27.5');
    expect(
      rendered,
      'a registered nurse was shown a percentage and a set of payment terms with '
      + 'nothing on the page saying the fee is charged to the household — § 1812.530',
    ).toContain('charged to the household');
  });

  it('and so does the rate page, where they set their own figure', async () => {
    const rendered = await render(path.join(ROOT, 'app/(provider)/pro/rate/page.tsx'));
    expect(rendered).toContain('charged to the household');
  });

  it('and the record of what we gave them', async () => {
    const rendered = await render(path.join(ROOT, 'app/(provider)/pro/documents/page.tsx'));
    expect(rendered).toContain('charged to the household');
  });

  it('nothing on the schedule page implies the figure is theirs', async () => {
    const rendered = await render(path.join(ROOT, 'app/(provider)/pro/fee-schedule/page.tsx'));
    for (const bad of ['your fee', 'you owe', 'you pay', 'deducted from your']) {
      expect(rendered.toLowerCase(), `the schedule page says "${bad}"`).not.toContain(bad);
    }
  });
});

// ---------------------------------------------------------------------------
// § 1812.531, while the wording is in one place: no fee splitting either.
// ---------------------------------------------------------------------------

describe('and nothing on the provider surface shares a fee with anybody', () => {
  it('offers no referral bonus, bounty or finder’s payment to a provider', () => {
    const offenders: string[] = [];
    for (const file of PROVIDER_SOURCE) {
      const src = code(file);
      for (const pattern of [
        /\b(referral|signing|joining|loyalty) bonus\b/i,
        /\b(finder'?s fee|bounty|kickback|rebate|commission)\b/i,
        /\brefer a (friend|colleague|nurse)\b/i,
      ]) {
        if (pattern.test(src)) offenders.push(`${rel(file)}: ${pattern}`);
      }
    }
    expect(
      offenders,
      `${offenders.join('\n')}\n§ 1812.531 forbids a nurses' registry dividing fees `
      + 'with a nurse, among others. There is nowhere in the schema to record one, so '
      + 'an offer on this surface would be a promise nothing could keep.',
    ).toEqual([]);
  });
});
