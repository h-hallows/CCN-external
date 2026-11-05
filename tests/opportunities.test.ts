/**
 * W9 — opportunities, engagements, résumé, documents. Web build spec § 4.2.
 *
 * The milestone's gates are "Accept and Decline identical weight" and "No countdown in
 * the DOM". Both are about pressure rather than correctness, so both are asserted
 * statically over the source: a countdown and a primary button are things you can only
 * catch by looking at what is rendered, and neither would fail a behavioural test.
 *
 * The third thing tested hard is what a decline leaves behind. Architecture spec § 6.4:
 * "Decline takes no reason and sets no flag anywhere that could later read as a
 * performance record." The assertion below is that answering changes exactly one table.
 */
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DbHandle } from '@h-hallows/core/db';
import { seededDb } from '@h-hallows/core/testing';
import {
  currentOpportunities, engagements, openOpportunities, respondToOpportunity,
} from '@/lib/opportunities';
import { ROOT, code, rel, walk } from './importGraph';
import type { PortalSession } from '@/lib/session';

let db: DbHandle;
let me: PortalSession;
let other: PortalSession;
let myProviderId: string;
let otherProviderId: string;
let caseId: string;
let referralId: string;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const [row] = await db.query<T>(sql, params);
  if (!row) throw new Error(`fixture query returned no rows: ${sql}`);
  return row;
}

async function makeProvider(email: string, providerId: string): Promise<PortalSession> {
  const user = await one<{ id: string }>(
    `INSERT INTO users (email, display_name, role) VALUES ($1, $2, 'provider')
     ON CONFLICT (email) DO UPDATE SET role = 'provider' RETURNING id`,
    [email, email.split('@')[0]],
  );
  await db.query(
    `INSERT INTO provider_users (user_id, provider_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [user.id, providerId],
  );
  return {
    userId: user.id, email, displayName: email.split('@')[0]!, role: 'provider',
    householdId: null, providerId,
  };
}

/** Row counts for every table, so "changed nothing else" can be asserted literally. */
async function census(): Promise<Record<string, number>> {
  const tables = await db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
        AND table_name <> '_migrations'
      ORDER BY table_name`);
  const out: Record<string, number> = {};
  for (const t of tables) {
    const row = await one<{ n: string }>(`SELECT count(*)::text AS n FROM "${t.table_name}"`);
    out[t.table_name] = Number(row.n);
  }
  return out;
}

beforeAll(async () => {
  db = await seededDb();
  // Providers the seed has not already referred anywhere, so "one open opportunity"
  // means the one this file creates. Naming a provider outright gave two, because the
  // seed had referred them — the kind of fixture that passes until the seed changes.
  const clean = await db.query<{ id: string }>(
    `SELECT p.id FROM providers p
      WHERE p.id NOT IN (SELECT provider_id FROM referrals)
        AND p.status = 'active'
      ORDER BY p.full_name
      LIMIT 2`);
  expect(clean.length, 'the seed has no unreferred providers to use').toBe(2);
  myProviderId = clean[0]!.id;
  otherProviderId = clean[1]!.id;

  me = await makeProvider('w9-me@example.com', myProviderId);
  other = await makeProvider('w9-other@example.com', otherProviderId);

  const household = await one<{ id: string }>(
    `INSERT INTO households (display_name, dm_name, cr_area, status)
     VALUES ('W9 fixture household', 'W9 decision maker', 'brentwood', 'active')
     RETURNING id`);
  caseId = (await one<{ id: string }>(
    `INSERT INTO cases (household_id, status, care, urgency, schedule, hours_per_week,
                        starts_on, needs_profile, household_profile)
     VALUES ($1, 'active', 'companion', 'routine',
             ARRAY['Mon:AM','Wed:AM'], 12, current_date + 7,
             'She would like someone there for breakfast and a walk.',
             'The side gate code is easier than the front door.')
     RETURNING id`, [household.id])).id;

  const timeline = await one<{ id: string }>(
    `INSERT INTO timeline_entries (case_id, type, author, body)
     VALUES ($1, 'disclosure', 'operator', 'Oral disclosure given') RETURNING id`, [caseId]);
  const disclosure = await one<{ id: string }>(
    `INSERT INTO disclosures (case_id, timeline_id, disclosed_to, disclosed_by, method,
                              written_due_on)
     VALUES ($1, $2, 'W9 decision maker', 'operator', 'phone', current_date + 3)
     RETURNING id`, [caseId, timeline.id]);
  referralId = (await one<{ id: string }>(
    `INSERT INTO referrals (case_id, provider_id, disclosure_id, referred_by)
     VALUES ($1, $2, $3, 'operator') RETURNING id`,
    [caseId, myProviderId, disclosure.id])).id;
});

describe('an open opportunity says what the work is', () => {
  it('shows the case, the pattern, the hours and the household\'s own words', async () => {
    const open = await openOpportunities(me);
    expect(open).toHaveLength(1);
    const o = open[0]!;
    expect(o.care).toBe('companion');
    expect(o.pattern).toEqual(['Mon:AM', 'Wed:AM']);
    expect(o.hoursPerWeek).toBe(12);
    expect(o.needs).toContain('breakfast');
  });

  it('tells them the area, which they cannot read from the household row', async () => {
    const o = (await openOpportunities(me))[0]!;
    expect(o.area).toBe('brentwood');
  });

  it('carries nothing else about the household', async () => {
    const serialised = JSON.stringify(await openOpportunities(me)).toLowerCase();
    for (const leak of ['w9 decision maker', 'w9 fixture household', 'phone', 'address']) {
      expect(serialised, `an opportunity leaks "${leak}"`).not.toContain(leak);
    }
  });

  it('shows another provider nothing', async () => {
    expect(await openOpportunities(other)).toEqual([]);
  });
});

describe('answering costs the same either way', () => {
  it('a decline writes one timeline note and changes nothing else anywhere', async () => {
    const before = await census();

    const result = await respondToOpportunity(me, referralId, false);
    expect(result.ok).toBe(true);

    const after = await census();
    const changed = Object.keys(after).filter((t) => after[t] !== before[t]);
    // The whole of § 6.4 in one assertion: no outcome write, no counter, no flag, no
    // row anywhere that could later be grouped by and read as a performance record.
    expect(changed).toEqual(['timeline_entries']);
    expect(after.timeline_entries).toBe(before.timeline_entries! + 1);
  });

  it('the note is the provider\'s own, on the case, and carries no reason field', async () => {
    const note = await one<{ type: string; author: string; body: string; provider_id: string }>(
      `SELECT type::text AS type, author, body, provider_id
         FROM timeline_entries WHERE provider_id = $1 ORDER BY at DESC LIMIT 1`,
      [myProviderId]);
    expect(note.type).toBe('note');
    expect(note.provider_id).toBe(myProviderId);
    expect(note.body).toContain('not taking this one');
    // No "because", no reason, nothing the provider had to justify.
    expect(note.body.toLowerCase()).not.toMatch(/\breason\b|\bbecause\b/);
  });

  it('leaves the referral itself untouched — the operator decides that', async () => {
    const row = await one<{ outcome: string | null }>(
      `SELECT outcome::text AS outcome FROM referrals WHERE id = $1`, [referralId]);
    expect(row.outcome).toBeNull();
  });

  it('takes it off the list of things still to answer', async () => {
    expect(await openOpportunities(me)).toEqual([]);
  });

  it('but keeps it on the screen, with what they answered', async () => {
    // A server action refreshes the route whether or not it revalidates, so an
    // answered opportunity that vanished from this list would be unmounted along with
    // its own acknowledgement — the provider clicks and the card silently disappears.
    const current = await currentOpportunities(me);
    expect(current).toHaveLength(1);
    expect(current[0]!.answeredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('will not take a second answer', async () => {
    const again = await respondToOpportunity(me, referralId, true);
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.reason).toBe('already_answered');
  });

  it('refuses an answer to somebody else\'s opportunity, and writes nothing', async () => {
    const before = await census();
    const result = await respondToOpportunity(other, referralId, true);
    expect(result.ok).toBe(false);
    expect(await census()).toEqual(before);
  });
});

describe('engagements are the provider\'s own record', () => {
  it('lists what they were put forward for, answered or not', async () => {
    const all = await engagements(me);
    expect(all).toHaveLength(1);
    expect(all[0]!.answeredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('carries the household profile, which travels with the work', async () => {
    const all = await engagements(me);
    expect(all[0]!.householdProfile).toContain('side gate');
  });

  it('shows another provider none of it', async () => {
    expect(await engagements(other)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The two W9 gates, asserted over the source because neither would fail at runtime.
// ---------------------------------------------------------------------------

const PROVIDER_FILES = () => [
  ...walk(path.join(ROOT, 'app', '(provider)')),
  path.join(ROOT, 'components', 'OpportunityAnswer.tsx'),
  path.join(ROOT, 'lib', 'opportunities.ts'),
  path.join(ROOT, 'lib', 'opportunityState.ts'),
];

describe('accept and decline are rendered identically', () => {
  const src = () => code(path.join(ROOT, 'components', 'OpportunityAnswer.tsx'));

  it('there is one button component, used twice', () => {
    // The strongest form of "identical": not two buttons styled alike, one button
    // rendered twice with a different label. Two <button> elements could drift; one
    // cannot.
    const buttons = src().match(/<button/g) ?? [];
    expect(buttons).toHaveLength(1);
    const answers = src().match(/<Answer\s/g) ?? [];
    expect(answers).toHaveLength(2);
  });

  it('neither is a primary button', () => {
    // A primary button is a recommendation, and a registry recommending that a
    // provider accept work is a registry directing it — § 687.2(e).
    expect(src()).not.toContain('btn-primary');
    expect(src()).toContain("className=\"btn\"");
  });

  it('the two differ only in label and submitted value', () => {
    const uses = [...src().matchAll(/<Answer\s+([^/]*)\/>/g)].map((m) => m[1]!);
    expect(uses).toHaveLength(2);
    for (const u of uses) {
      const props = [...u.matchAll(/(\w+)=/g)].map((m) => m[1]);
      expect(props.sort()).toEqual(['label', 'value']);
    }
  });
});

describe('nothing in the provider portal counts down', () => {
  it('uses no language of deadlines or urgency', () => {
    const banned = /\b(countdown|expires?|expiring|deadline|time left|hours left|days left|remaining|urgent|hurry|act fast|respond by|closes in|running out)\b/i;
    for (const file of PROVIDER_FILES()) {
      // The credentials screen legitimately says when a credential runs out; that is a
      // fact about a document, not pressure to answer. Scoped out by name rather than
      // by weakening the pattern.
      if (rel(file).includes('credentials')) continue;
      const found = banned.exec(code(file));
      expect(found, `${rel(file)} says "${found?.[0]}"`).toBeNull();
    }
  });

  it('runs no timer of any kind', () => {
    for (const file of PROVIDER_FILES()) {
      const src = code(file);
      for (const timer of ['setInterval', 'requestAnimationFrame', 'Date.now()', 'new Date()']) {
        expect(
          src.includes(timer),
          `${rel(file)} uses ${timer}, which is how a countdown starts`,
        ).toBe(false);
      }
    }
  });
});

describe('the résumé belongs to the provider, not to us', () => {
  const src = () => code(path.join(ROOT, 'app/(provider)/pro/resume/page.tsx'));

  it('carries no registry name or branding', () => {
    // § 1812.5095(b)(1)(C): the provider is free to work for others. A résumé with our
    // name across it undercuts the thing it exists to demonstrate.
    for (const branded of ['DISPLAY_NAME', 'LEGAL_NAME', 'brand']) {
      expect(src(), `the résumé imports ${branded}`).not.toContain(branded);
    }
  });

  it('carries no opinion of ours about them', () => {
    const banned = /\b(rating|rated|score|verified by|endorsed|approved|badge|tier|reliability|percentile|top|preferred provider)\b/i;
    const found = banned.exec(src());
    expect(found, `the résumé says "${found?.[0]}"`).toBeNull();
  });

  it('titles itself with the provider, bypassing the site title template', () => {
    // Browsers print the document title in the page header. The root layout appends
    // the site name through a template, so without `absolute` the registry's name
    // lands across the top of every printed copy — undoing the one thing this page is
    // for. Caught in a browser, not in review.
    expect(src()).toContain('absolute:');
    expect(src()).toContain('generateMetadata');
  });

  it('carries no licence number', () => {
    expect(src()).not.toContain('licenseNumber');
    expect(src()).not.toContain('license_number');
  });
});
