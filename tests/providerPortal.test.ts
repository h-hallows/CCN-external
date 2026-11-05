/**
 * W8 — the provider's own record. Web build spec § 4.2.
 *
 * The milestone's gates are "provider cannot write expiry, verified or source fields"
 * and "fee schedule shows the seven-day embargo". The first is tested hardest, because
 * it is the one that turned out to be broken: migration 0003 granted providers INSERT
 * on `credentials`, and `eligibility()` counts the presence of a row of the required
 * type as that requirement being met, so a provider could insert their own Live Scan
 * and move onto a household's shortlist. Migration 0008 closed it.
 *
 * What is absent from this file matters too. There is no test for a rate cap, a
 * suggested range, an acceptance rate or a score, because none of those exists — I5,
 * I1 and I2. A couple of assertions below check that they still do not.
 */
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DbHandle } from '@h-hallows/core/db';
import { seededDb } from '@h-hallows/core/testing';
import {
  credentialStanding, providerSelf, saveAvailability, saveLimits, savePhoto,
  saveProviderProfile, saveRate, submitCredential,
} from '@/lib/pro';
import { EMBARGO_DAYS, feeSchedulesFor, hasFeeSchedule } from '@/lib/feeSchedule';
import { ROOT, code, reachableFrom, rel, walk } from './importGraph';
import type { PortalSession } from '@/lib/session';

let db: DbHandle;
let me: PortalSession;
let other: PortalSession;
let myProviderId: string;
let otherProviderId: string;

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
    userId: user.id, email, displayName: email, role: 'provider',
    householdId: null, providerId,
  };
}

beforeAll(async () => {
  db = await seededDb();
  // An LVN, so the fee schedule applies.
  myProviderId = (await one<{ id: string }>(
    `SELECT id FROM providers WHERE full_name = 'Tomás Beltrán'`)).id;
  otherProviderId = (await one<{ id: string }>(
    `SELECT id FROM providers WHERE id <> $1 LIMIT 1`, [myProviderId])).id;

  me = await makeProvider('w8-me@example.com', myProviderId);
  other = await makeProvider('w8-other@example.com', otherProviderId);
});

describe('a provider states things about themselves', () => {
  it('reads its own record and nobody else\'s', async () => {
    const mine = await providerSelf(me);
    expect(mine).not.toBeNull();
    expect(mine!.providerId).toBe(myProviderId);

    const theirs = await providerSelf(other);
    expect(theirs!.providerId).toBe(otherProviderId);
    expect(theirs!.providerId).not.toBe(myProviderId);
  });

  it('writes the preferred name, bio and contact details', async () => {
    const result = await saveProviderProfile(me, {
      preferredName: 'Tommy',
      bio: 'Twelve years on post-surgical recovery, mostly orthopaedic.',
      phone: '(310) 555-0101',
      email: 'tomas@example.com',
    });
    expect(result.ok).toBe(true);

    const mine = await providerSelf(me);
    expect(mine!.preferredName).toBe('Tommy');
    expect(mine!.bio).toContain('post-surgical');
  });

  it('cannot change its own referral status, whatever is sent', async () => {
    // Directly, as the provider, because this is the guard trigger rather than
    // anything in lib/pro.ts. I4: stopping referrals is the registry's lever.
    let denied = false;
    try {
      await db.transaction(async (tx) => {
        await tx.query(`SET LOCAL ROLE ccn_app`);
        await tx.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
          JSON.stringify({
            ccn_role: 'provider', ccn_user_id: me.userId, ccn_provider_id: myProviderId,
          }),
        ]);
        await tx.query(
          `UPDATE providers SET status = 'do_not_refer' WHERE id = $1`, [myProviderId]);
      });
    } catch { denied = true; }
    expect(denied, 'a provider changed their own referral status').toBe(true);
  });

  it('stores what it will not take on verbatim, with no tidying', async () => {
    const words = 'No heavy lifting without a hoist. I do not drive clients.';
    expect((await saveLimits(me, words)).ok).toBe(true);
    expect((await providerSelf(me))!.restrictions).toBe(words);
  });
});

describe('the rate is the provider\'s, and nothing suggests one', () => {
  it('accepts a positive number', async () => {
    expect((await saveRate(me, { rateHourly: '82.50', rateNotes: '' })).ok).toBe(true);
    expect(Number((await providerSelf(me))!.rateHourly)).toBe(82.5);
  });

  it('accepts no rate at all, which is a real answer', async () => {
    expect((await saveRate(me, { rateHourly: '', rateNotes: 'Happy to discuss.' })).ok)
      .toBe(true);
    const mine = await providerSelf(me);
    expect(mine!.rateHourly).toBeNull();
    expect(mine!.rateNotes).toBe('Happy to discuss.');
  });

  it('refuses zero, a negative and a non-number, and nothing else', async () => {
    for (const bad of ['0', '-5', 'ask me']) {
      const result = await saveRate(me, { rateHourly: bad, rateNotes: '' });
      expect(result.ok, `${bad} was accepted`).toBe(false);
    }
    // And a very large number IS accepted. There is no cap, deliberately: a maximum
    // is the registry setting the rate. I5, § 1812.5095(b)(3).
    expect((await saveRate(me, { rateHourly: '500', rateNotes: '' })).ok).toBe(true);
  });

  it('computes no suggestion, comparison or benchmark', () => {
    // Over the LOGIC only. The page's copy says "we do not set it, cap it, suggest
    // it", and a word search over prose would read that denial as the thing it denies
    // — the same trap as the statutory text containing "referrals". What matters is
    // that nothing here derives a figure.
    const banned = /\b(suggested|recommend|recommended|average|median|market|typical|comparable|benchmark|percentile)\b/i;
    const found = banned.exec(code(path.join(ROOT, 'lib/pro.ts')));
    expect(found, `lib/pro.ts says "${found?.[0]}"`).toBeNull();
  });

  it('puts no figure in front of the provider but their own', () => {
    // The assertion that actually catches a suggested rate appearing in the UI: the
    // rate screen contains no money literal at all. The only number it can render is
    // whatever the provider last saved.
    const src = code(path.join(ROOT, 'app/(provider)/pro/rate/page.tsx'));
    const money = /\$\s*\d|\b\d{2,3}(?:\.\d+)?\s*(?:an hour|per hour|\/\s*h)/i;
    const found = money.exec(src);
    expect(found, `the rate screen shows the figure "${found?.[0]}"`).toBeNull();
    expect(src).toContain('me.rateHourly');
  });

  it('offers no score, ranking or acceptance metric on any provider screen', () => {
    // I1, I2, § 687.2(d)-(e). A measured provider is a managed provider.
    const banned = /\b(score|scores|scoring|rating|ranked|ranking|leaderboard|acceptance rate|response time|streak|badge|tier|performance|coaching|training|course|module)\b/i;
    for (const file of walk(path.join(ROOT, 'app', '(provider)'))) {
      const found = banned.exec(code(file));
      expect(found, `${rel(file)} says "${found?.[0]}"`).toBeNull();
    }
  });
});

describe('availability is theirs to change at any time', () => {
  it('saves a week', async () => {
    expect((await saveAvailability(me, ['Mon:AM', 'Tue:PM', 'Sat:NOC'])).ok).toBe(true);
    expect((await providerSelf(me))!.availability.sort())
      .toEqual(['Mon:AM', 'Sat:NOC', 'Tue:PM']);
  });

  it('saves an empty week without complaint', async () => {
    expect((await saveAvailability(me, [])).ok).toBe(true);
    expect((await providerSelf(me))!.availability).toEqual([]);
  });

  it('drops anything that is not a real slot', async () => {
    await saveAvailability(me, ['Mon:AM', 'Funday:AM', 'Mon:LUNCH', 'Mon:AM']);
    expect((await providerSelf(me))!.availability).toEqual(['Mon:AM']);
  });
});

describe('a photograph cannot exist without the consent to show it', () => {
  it('refuses a photo with no agreement', async () => {
    const result = await savePhoto(me, { photoUrl: 'https://example.com/a.jpg', consent: false });
    expect(result.ok).toBe(false);
    expect((await providerSelf(me))!.photoUrl).toBeNull();
  });

  it('stores the photo and the consent date together', async () => {
    expect((await savePhoto(me, { photoUrl: 'https://example.com/a.jpg', consent: true })).ok)
      .toBe(true);
    const mine = await providerSelf(me);
    expect(mine!.photoUrl).toBe('https://example.com/a.jpg');
    expect(mine!.photoConsentOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('clearing it removes the consent record too', async () => {
    expect((await savePhoto(me, { photoUrl: '', consent: false })).ok).toBe(true);
    const mine = await providerSelf(me);
    expect(mine!.photoUrl).toBeNull();
    expect(mine!.photoConsentOn).toBeNull();
  });
});

describe('a provider hands documents in; it does not verify itself', () => {
  it('shows what is on file and what is missing', async () => {
    const standing = await credentialStanding(me);
    expect(standing).not.toBeNull();
    const liveScan = standing!.credentials.find((c) => c.type === 'live_scan');
    expect(liveScan).toBeDefined();
    expect(liveScan!.required).toBe(true);
  });

  it('a submission writes no credential row — the W8 gate', async () => {
    const before = await one<{ n: string }>(
      `SELECT count(*)::text AS n FROM credentials WHERE provider_id = $1`, [myProviderId]);

    const result = await submitCredential(me, {
      type: 'live_scan', identifier: 'ATI-12345',
      documentUrl: 'https://example.com/scan.pdf', note: 'Done last week',
    });
    expect(result.ok).toBe(true);

    const after = await one<{ n: string }>(
      `SELECT count(*)::text AS n FROM credentials WHERE provider_id = $1`, [myProviderId]);
    expect(after.n).toBe(before.n);

    const subs = await one<{ n: string; state: string }>(
      `SELECT count(*)::text AS n, max(state::text) AS state
         FROM credential_submissions WHERE provider_id = $1`, [myProviderId]);
    expect(Number(subs.n)).toBe(1);
    expect(subs.state).toBe('submitted');
  });

  it('handing something in does not make the provider eligible', async () => {
    const standing = await credentialStanding(me);
    // The Live Scan was handed in above and is still blocking, because nothing has
    // checked it. This is the whole point of the submissions table.
    expect(standing!.blocking).toContain('live_scan');
    expect(standing!.eligible).toBe(false);
  });

  it('the submission is visible to its author and to nobody else', async () => {
    const mine = await credentialStanding(me);
    expect(mine!.credentials.some((c) => c.submittedAt !== null)).toBe(true);
    const theirs = await credentialStanding(other);
    expect(theirs!.credentials.every((c) => c.submittedAt === null)).toBe(true);
  });

  it('no module reachable from (provider) writes to credentials', () => {
    // The analogue of the W6 gate. A provider screen may READ its own credentials to
    // say what is missing; it may never create or amend one, because eligibility is
    // computed from that table.
    const reachable = reachableFrom(walk(path.join(ROOT, 'app', '(provider)')));
    const write = /\b(?:insert\s+into|update|delete\s+from)\s+(?:only\s+)?"?credentials"?\b/i;
    for (const file of reachable) {
      const found = write.exec(code(file));
      expect(found, `${rel(file)} writes to credentials`).toBeNull();
    }
  });
});

describe('the fee schedule and its seven-day embargo', () => {
  it('applies to nurses and to nobody else', () => {
    expect(hasFeeSchedule('RN')).toBe(true);
    expect(hasFeeSchedule('LVN')).toBe(true);
    for (const t of ['CNA', 'HCA', 'companion']) expect(hasFeeSchedule(t)).toBe(false);
  });

  it('the database refuses a schedule posted less than seven days ahead', async () => {
    let denied = false;
    try {
      await db.query(
        `INSERT INTO fee_schedules (version, max_fee_pct, payment_terms, body,
                                    posted_at, effective_from)
         VALUES (9001, 15, 'Net 15', 'body', now(), current_date + 3)`);
    } catch { denied = true; }
    expect(denied, 'the seven-day embargo was not enforced').toBe(true);
  });

  it('accepts one posted at least seven days ahead, and reports the notice given', async () => {
    const posted9002 = await one<{ id: string }>(
      `INSERT INTO fee_schedules (version, max_fee_pct, payment_terms, body,
                                  posted_at, effective_from)
       VALUES (9002, 15, 'Net 15', 'The fee is charged to the household.',
               now(), current_date + ($1)::int)
       RETURNING id`,
      [EMBARGO_DAYS + 1]);
    // A provider sees a schedule once it is recorded as delivered to them —
    // fee_schedules_provider_select. Without a delivery row there is nothing to see,
    // which is the policy working, not a gap.
    await db.query(
      `INSERT INTO fee_schedule_deliveries
         (provider_id, schedule_id, delivered_at, delivered_by, before_interview)
       VALUES ($1, $2, now(), 'operator', true)`, [myProviderId, posted9002.id]);

    const schedules = await feeSchedulesFor(me);
    const posted = schedules.find((s) => s.version === 9002);
    expect(posted).toBeDefined();
    expect(posted!.noticeDays).toBeGreaterThanOrEqual(EMBARGO_DAYS);
    // Not yet in force: its effective date has not arrived.
    expect(posted!.inForce).toBe(false);
  });

  it('keeps prior versions, so the terms at the time are still knowable', async () => {
    const older = await one<{ id: string }>(
      `INSERT INTO fee_schedules (version, max_fee_pct, payment_terms, body,
                                  posted_at, effective_from)
       VALUES (9000, 12, 'Net 30', 'An older schedule.',
               now() - interval '60 days', current_date - 30)
       RETURNING id`);
    await db.query(
      `INSERT INTO fee_schedule_deliveries
         (provider_id, schedule_id, delivered_at, delivered_by, before_interview)
       VALUES ($1, $2, now() - interval '60 days', 'operator', true)`,
      [myProviderId, older.id]);

    const schedules = await feeSchedulesFor(me);
    expect(schedules.map((s) => s.version)).toContain(9000);
    expect(schedules.find((s) => s.version === 9000)!.inForce).toBe(true);
  });

  it('marks a posted-but-not-yet-effective schedule as upcoming, not as history', async () => {
    // The embargo's whole purpose is warning, so a schedule inside its notice period
    // has to be distinguishable from one that has already been superseded. Listing it
    // among prior versions buries the only item on the page a provider can act on.
    const schedules = await feeSchedulesFor(me);
    const soon = schedules.find((s) => s.version === 9002);
    const past = schedules.find((s) => s.version === 9000);
    expect(soon!.upcoming).toBe(true);
    expect(soon!.inForce).toBe(false);
    expect(past!.upcoming).toBe(false);
    expect(past!.inForce).toBe(true);
  });

  it('shows a provider nothing that was never delivered to them', async () => {
    await db.query(
      `INSERT INTO fee_schedules (version, max_fee_pct, payment_terms, body,
                                  posted_at, effective_from)
       VALUES (9003, 20, 'Net 7', 'Posted but not handed to anyone.',
               now(), current_date + 30)`);
    const schedules = await feeSchedulesFor(me);
    expect(schedules.map((s) => s.version)).not.toContain(9003);
  });
});
