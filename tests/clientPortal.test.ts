/**
 * W7 — the rest of the household portal. Web build spec § 4.1.
 *
 * The milestone's own gates are "household can edit its own profile document" and
 * "feedback carries use_restriction", and both are asserted here from the outside: by
 * calling the same functions the pages call, through `asPortalUser`, which drops to the
 * non-owning ccn_app role so the § 4 policies decide rather than decorate.
 *
 * The profile is the one field a household may write anywhere in this system, so what
 * it may NOT write is tested at least as hard as what it may.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ROOT, code, imports, isServerBoundary, reachableFrom, rel, walk,
} from './importGraph';
import type { DbHandle } from '@h-hallows/core/db';
import { seededDb } from '@h-hallows/core/testing';
import { caseProfiles, saveCaseProfile, PROFILE_MAX } from '@/lib/caseProfile';
import { caseSchedules, byDay } from '@/lib/schedule';
import { caseDocuments } from '@/lib/documents';
import { feedbackSubject, saveFeedback } from '@/lib/feedback';
import { householdRequests, REQUEST_STATUS } from '@/lib/request';
import {
  AGAIN_QUESTION, NOTES_QUESTION, RATING_QUESTION, USE_NOTE,
} from '@/lib/feedbackState';
import type { PortalSession } from '@/lib/session';

let db: DbHandle;
let ours: PortalSession;
let theirs: PortalSession;
let caseId: string;
let referralId: string;
let primaryId: string;
let alternateId: string;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const [row] = await db.query<T>(sql, params);
  if (!row) throw new Error(`fixture query returned no rows: ${sql}`);
  return row;
}

async function makeHousehold(email: string, householdId: string): Promise<PortalSession> {
  const user = await one<{ id: string }>(
    `INSERT INTO users (email, display_name, role) VALUES ($1, $2, 'household')
     ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name RETURNING id`,
    [email, email.split('@')[0]],
  );
  await db.query(
    `INSERT INTO household_users (user_id, household_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [user.id, householdId],
  );
  return {
    userId: user.id, email, displayName: email, role: 'household',
    householdId, providerId: null, partnerId: null,
  };
}

beforeAll(async () => {
  db = await seededDb();

  const household = await one<{ id: string }>(
    `INSERT INTO households (display_name, dm_name, cr_area, status)
     VALUES ('W7 fixture household', 'W7 decision maker', 'brentwood', 'active')
     RETURNING id`);
  const other = await one<{ id: string }>(
    `INSERT INTO households (display_name, dm_name, cr_area, status)
     VALUES ('W7 fixture onlooker', 'W7 onlooker', 'malibu', 'active')
     RETURNING id`);

  primaryId = (await one<{ id: string }>(
    `SELECT id FROM providers WHERE full_name = 'Imelda Santoyo'`)).id;
  alternateId = (await one<{ id: string }>(
    `SELECT id FROM providers WHERE full_name = 'Grace Okonkwo'`)).id;

  caseId = (await one<{ id: string }>(
    `INSERT INTO cases (household_id, status, care, urgency, schedule, hours_per_week,
                        starts_on, primary_provider_id, alternate_provider_ids)
     VALUES ($1, 'active', 'companion', 'routine',
             ARRAY['Mon:AM','Tue:AM','Wed:PM'], 18, current_date,
             $2, ARRAY[$3]::uuid[])
     RETURNING id`, [household.id, primaryId, alternateId])).id;

  ours = await makeHousehold('w7-ours@example.com', household.id);
  theirs = await makeHousehold('w7-theirs@example.com', other.id);

  // Inside the window, and one deliberately outside it.
  await db.query(
    `INSERT INTO coverage_gaps (case_id, on_date, block, note)
     VALUES ($1, current_date + 2, 'AM', 'Imelda is away that morning')`, [caseId]);
  await db.query(
    `INSERT INTO coverage_gaps (case_id, on_date, block, resolved_provider_id)
     VALUES ($1, current_date + 5, 'PM', $2)`, [caseId, alternateId]);
  await db.query(
    `INSERT INTO coverage_gaps (case_id, on_date, block)
     VALUES ($1, current_date + 90, 'NOC')`, [caseId]);

  // A disclosure and the referral it belongs to.
  const timeline = await one<{ id: string }>(
    `INSERT INTO timeline_entries (case_id, type, author, body)
     VALUES ($1, 'disclosure', 'operator', 'Oral disclosure given by telephone')
     RETURNING id`, [caseId]);
  const disclosure = await one<{ id: string }>(
    `INSERT INTO disclosures (case_id, timeline_id, disclosed_to, disclosed_by, method,
                              written_due_on, nurse_disclosure_required)
     VALUES ($1, $2, 'W7 decision maker', 'operator', 'phone', current_date + 3, true)
     RETURNING id`, [caseId, timeline.id]);
  referralId = (await one<{ id: string }>(
    `INSERT INTO referrals (case_id, provider_id, disclosure_id, referred_by)
     VALUES ($1, $2, $3, 'operator') RETURNING id`,
    [caseId, primaryId, disclosure.id])).id;
});

describe('the household profile is the one thing a household writes', () => {
  it('saves what the household typed, verbatim', async () => {
    const body = 'She is up by 6.30 and likes the radio on before anyone speaks to her.';
    const outcome = await saveCaseProfile(ours, caseId, body);
    expect(outcome.ok).toBe(true);

    const [profile] = await caseProfiles(ours);
    expect(profile!.body).toBe(body);
  });

  it('names the person who will read it, which is the point of writing it', async () => {
    const [profile] = await caseProfiles(ours);
    expect(profile!.readBy).toBe('Imelda Santoyo');
  });

  it('refuses a save against another household\'s case, and changes nothing', async () => {
    const before = await one<{ household_profile: string | null }>(
      `SELECT household_profile FROM cases WHERE id = $1`, [caseId]);

    const outcome = await saveCaseProfile(theirs, caseId, 'not theirs to write');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe('not_found');

    const after = await one<{ household_profile: string | null }>(
      `SELECT household_profile FROM cases WHERE id = $1`, [caseId]);
    expect(after.household_profile).toBe(before.household_profile);
  });

  it('refuses something longer than the field is for', async () => {
    const outcome = await saveCaseProfile(ours, caseId, 'x'.repeat(PROFILE_MAX + 1));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe('too_long');
  });

  it('cannot reach any other column on the case, whatever statement is sent', async () => {
    // Not through the app's function — directly, as the household, to prove the
    // database refuses it rather than the TypeScript. This is migration 0003's guard
    // trigger, and it is what stops a household editing the terms or the needs profile
    // (I10) by way of the one field they are allowed.
    let denied = false;
    try {
      await db.transaction(async (tx) => {
        await tx.query(`SET LOCAL ROLE ccn_app`);
        await tx.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
          JSON.stringify({
            ccn_role: 'household',
            ccn_user_id: ours.userId,
            ccn_household_id: ours.householdId,
          }),
        ]);
        await tx.query(
          `UPDATE cases SET rate_agreed = 1, needs_profile = 'rewritten' WHERE id = $1`,
          [caseId]);
      });
    } catch {
      denied = true;
    }
    expect(denied, 'a household changed a column that is not its profile').toBe(true);
  });
});

describe('the schedule shows the pattern and the gaps, and allocates nothing', () => {
  it('returns the pattern the household asked for', async () => {
    const [schedule] = await caseSchedules(ours);
    expect(schedule!.pattern).toEqual(['Mon:AM', 'Tue:AM', 'Wed:PM']);
    expect(byDay(schedule!.pattern).get('Mon')?.has('AM')).toBe(true);
    expect(byDay(schedule!.pattern).get('Thu')).toBeUndefined();
  });

  it('names the regular and the named alternates', async () => {
    const [schedule] = await caseSchedules(ours);
    expect(schedule!.primary).toBe('Imelda Santoyo');
    expect(schedule!.alternates).toEqual(['Grace Okonkwo']);
  });

  it('shows the gaps in the next thirty days and not beyond', async () => {
    const [schedule] = await caseSchedules(ours);
    expect(schedule!.gaps).toHaveLength(2);
    expect(schedule!.gaps.some((g) => g.coveredBy === 'Grace Okonkwo')).toBe(true);
    expect(schedule!.gaps.some((g) => g.coveredBy === null)).toBe(true);
  });

  it('shows another household nothing at all', async () => {
    expect(await caseSchedules(theirs)).toEqual([]);
  });
});

describe('documents', () => {
  it('lists the statutory record for the household\'s own case', async () => {
    const [docs] = await caseDocuments(ours);
    const keys = docs!.documents.map((d) => d.label);
    expect(keys).toContain('What we told you on the phone');
    expect(keys).toContain('Your written statement');
  });

  it('includes the nurses’ registry disclosure, because this case requires one', async () => {
    const [docs] = await caseDocuments(ours);
    const nurse = docs!.documents.find((d) => d.label.includes('registry disclosure'));
    expect(nurse).toBeDefined();
    // Not sent yet, so it reads as due rather than as delivered.
    expect(nurse!.state).toBe('due');
    expect(docs!.documents.some((d) => d.label.includes('complain'))).toBe(true);
  });

  it('records which version of the text was delivered', async () => {
    const [docs] = await caseDocuments(ours);
    for (const d of docs!.documents) {
      expect(d.version, `${d.label} has no version`).toBeTruthy();
      expect(d.citation).toMatch(/§/);
    }
  });

  it('shows another household none of it', async () => {
    expect(await caseDocuments(theirs)).toEqual([]);
  });

  it('never hands over the body of a draft or unfilled text', async () => {
    /*
     * Behavioural, not a source check. This shipped: the § 1812.533(b)(4) complaint
     * contacts are 'unfilled' with an empty body, and the screen rendered a "Read it"
     * panel containing nothing — a required disclosure presented as though it existed
     * and said nothing. Two drafts rendered as settled text. A reader cannot tell a
     * draft from a final version, so showing one is worse than showing none.
     */
    const [docs] = await caseDocuments(ours);
    const undeliverable = docs!.documents.filter((d) => !d.deliverable);
    expect(undeliverable.length, 'the fixture no longer covers an undeliverable text')
      .toBeGreaterThan(0);
    for (const d of undeliverable) {
      expect(d.text, `${d.label} leaked a body it may not show`).toBe('');
    }
    // And the ones that may be shown still are, so this is not passing vacuously.
    const deliverable = docs!.documents.filter((d) => d.deliverable);
    expect(deliverable.length).toBeGreaterThan(0);
    for (const d of deliverable) expect(d.text.length).toBeGreaterThan(0);
  });
});

describe('feedback is about the referral service, never about the person', () => {
  it('neither question is about the provider', () => {
    // I7 and § 687.2(e). A question about a named person is the first step of a
    // performance workflow whatever the column is called, so neither question refers
    // to one — not by role, not by pronoun.
    const aboutAPerson = /\b(provider|nurse|carer|caregiver|aide|she|he|her|him|they|them|their)\b/i;
    for (const question of [RATING_QUESTION, AGAIN_QUESTION, NOTES_QUESTION]) {
      const found = aboutAPerson.exec(question);
      expect(found, `"${question}" refers to a person with "${found?.[0]}"`).toBeNull();
    }
  });

  it('tells the household what it is used for and what it is not', () => {
    expect(USE_NOTE).toMatch(/not shared with the provider/i);
    expect(USE_NOTE).toMatch(/managed, assessed or paid/i);
  });

  it('finds the referral it belongs to, with the date and the name', async () => {
    const subject = await feedbackSubject(ours, referralId);
    expect(subject).not.toBeNull();
    expect(subject!.providerName).toBe('Imelda Santoyo');
    expect(subject!.referredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(subject!.answeredOn).toBeNull();
  });

  it('does not find another household\'s referral', async () => {
    expect(await feedbackSubject(theirs, referralId)).toBeNull();
  });

  it('writes the use restriction on the row — the W7 gate', async () => {
    const outcome = await saveFeedback(ours, {
      referralId, introductionRating: 4, wouldAskAgain: true,
      notes: 'The call beforehand was the useful part.',
    });
    expect(outcome.ok).toBe(true);

    const row = await one<{
      use_restriction: string; referral_service_rating: number; would_refer_again: boolean;
    }>(
      `SELECT use_restriction, referral_service_rating, would_refer_again
         FROM referral_feedback WHERE referral_id = $1`, [referralId]);
    expect(row.use_restriction).toBe('referral_decisions_only');
    expect(row.referral_service_rating).toBe(4);
    expect(row.would_refer_again).toBe(true);
  });

  it('will not take a second answer for the same referral', async () => {
    const outcome = await saveFeedback(ours, {
      referralId, introductionRating: 1, wouldAskAgain: false,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe('already_answered');

    const row = await one<{ n: string }>(
      `SELECT count(*)::text AS n FROM referral_feedback WHERE referral_id = $1`,
      [referralId]);
    expect(Number(row.n)).toBe(1);
  });

  it('refuses a rating outside the scale, and writes nothing', async () => {
    const before = await one<{ n: string }>(
      `SELECT count(*)::text AS n FROM referral_feedback`);
    const outcome = await saveFeedback(theirs, {
      referralId, introductionRating: 9, wouldAskAgain: true,
    });
    expect(outcome.ok).toBe(false);
    const after = await one<{ n: string }>(
      `SELECT count(*)::text AS n FROM referral_feedback`);
    expect(after.n).toBe(before.n);
  });

  it('creates no referral, ever', async () => {
    const row = await one<{ n: string }>(
      `SELECT count(*)::text AS n FROM referrals WHERE case_id = $1`, [caseId]);
    expect(Number(row.n)).toBe(1);
  });
});

describe('the requests list', () => {
  it('survives the bench it was made against being withdrawn', async () => {
    const shortlist = await one<{ id: string }>(
      `INSERT INTO published_shortlists (case_id, published_by)
       VALUES ($1, 'operator') RETURNING id`, [caseId]);
    await db.query(
      `INSERT INTO published_shortlist_items (shortlist_id, provider_id, position)
       VALUES ($1, $2, 1)`, [shortlist.id, primaryId]);
    await db.query(
      `INSERT INTO shortlist_requests (shortlist_id, provider_id, requested_by, note)
       VALUES ($1, $2, $3, 'Could we meet her?')`,
      [shortlist.id, primaryId, ours.userId]);
    await db.query(
      `UPDATE published_shortlists SET withdrawn_at = now() WHERE id = $1`, [shortlist.id]);

    const requests = await householdRequests(ours);
    expect(requests).toHaveLength(1);
    // The name is readable because of migration 0007. Before it, this row would have
    // rendered with no provider on it at all.
    expect(requests[0]!.providerName).toBe('Imelda Santoyo');
    expect(requests[0]!.status).toBe('pending');
  });

  it('shows another household none of them', async () => {
    expect(await householdRequests(theirs)).toEqual([]);
  });

  it('describes every status without claiming anything was arranged', () => {
    const banned = /\b(booked|booking|confirmed|reserved|placed|placement|hired|assigned|scheduled)\b/i;
    for (const [status, words] of Object.entries(REQUEST_STATUS)) {
      const text = `${words.label} ${words.detail}`;
      const found = banned.exec(text);
      expect(found, `the "${status}" wording says "${found?.[0]}"`).toBeNull();
    }
  });
});

/**
 * The bundle boundary.
 *
 * This exists because of a real break, not a hypothetical one. `HouseholdProfile` is a
 * client component and imported PROFILE_MAX from `lib/caseProfile`, which imports
 * `portalDb` → `session` → `next/headers`. The whole server chain followed it into the
 * browser bundle and the production build failed — while `tsc --noEmit` and all 126
 * tests passed, because tests import server modules directly under node and the
 * constraint is the bundler's rather than TypeScript's.
 *
 * A build catches it, but only once somebody runs one. This catches it in the suite,
 * and says which import did it rather than naming the module that happened to be at
 * the end of the chain.
 */
describe('no client component drags the server into the browser', () => {
  const SERVER_ONLY = [
    'next/headers',
    'node:crypto',
    '@h-hallows/core/db',
    '@/lib/portalDb',
    '@/lib/session',
  ];

  const clientEntries = [
    ...walk(path.join(ROOT, 'components')),
    ...walk(path.join(ROOT, 'app')),
  ].filter((f) => /^\s*(['"])use client\1/m.test(readFileSync(f, 'utf8')));

  it('found the client components, so this gate is not vacuous', () => {
    const names = clientEntries.map(rel);
    expect(names).toContain('components/HouseholdProfile.tsx');
    expect(names).toContain('components/RequestProvider.tsx');
    expect(names).toContain('components/ReferralFeedback.tsx');
  });

  it('reaches no server-only module from any of them', () => {
    for (const entry of clientEntries) {
      // The walk stops at a 'use server' file rather than filtering it out
      // afterwards: Next replaces that import with a network call, so what it imports
      // stays on the server and never reaches the browser bundle.
      const graph = reachableFrom([entry], isServerBoundary)
        .filter((f) => f === entry || !isServerBoundary(f));

      for (const file of graph) {
        for (const spec of imports(code(file))) {
          const offending = SERVER_ONLY.find(
            (s) => spec === s || spec.startsWith(`${s}/`));
          expect(
            offending,
            `${rel(entry)} reaches ${rel(file)}, which imports ${offending}`,
          ).toBeUndefined();
        }
      }
    }
  });
});
