/**
 * W6 gates. Web build spec § 10 names this one of the two milestones to review twice,
 * and § 11 states the gate as: no code path from `(client)` reaches `referrals`.
 *
 * Why that is the gate. A referral is a statutory event. It carries the § 1812.5095(f)
 * oral disclosure, the written statement within three California business days, and for
 * an RN or LVN the § 1812.533(b)(4) nurses' registry disclosure before care starts. A
 * household clicking a button cannot discharge any of those. So the click must produce a
 * request and stop, and the distance between the request and the referral is where every
 * one of those obligations lives.
 *
 * These run through the real action, which runs through `asPortalUser`, which drops to
 * the non-owning `ccn_app` role. Without that the policies would be present and inert.
 */
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { ROOT, code, reachableFrom, walk } from './importGraph';
import type { DbHandle } from '@h-hallows/core/db';
import { seededDb } from '@h-hallows/core/testing';
import { requestProvider, openRequestFor } from '@/lib/request';
import type { PortalSession } from '@/lib/session';

let db: DbHandle;
let ours: PortalSession;
let theirs: PortalSession;
let shortlistId: string;
let eligibleId: string;
let lapsedId: string;
let eligibleName: string;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const [row] = await db.query<T>(sql, params);
  if (!row) throw new Error(`fixture query returned no rows: ${sql}`);
  return row;
}

async function rowCount(table: string, where = 'true', params: unknown[] = []): Promise<number> {
  const row = await one<{ n: string }>(
    `SELECT count(*)::text AS n FROM ${table} WHERE ${where}`, params);
  return Number(row.n);
}

/**
 * Its own household, case and bench rather than the seeded ones.
 *
 * The suite runs single-fork, so every file shares one database. Borrowing the case that
 * tests/portal.test.ts builds on would make each file's assertions depend on which ran
 * first, which is the kind of test that passes until it matters.
 */
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
    householdId, providerId: null,
  };
}

beforeAll(async () => {
  db = await seededDb();

  // care = 'companion' on purpose: it clears both the skilled-care physician gate in
  // migration 0001 and the nurse-disclosure gate in 0004, neither of which this file is
  // about.
  const household = await one<{ id: string }>(
    `INSERT INTO households (display_name, dm_name, cr_area, status)
     VALUES ('W6 fixture household', 'Fixture decision maker', 'century_city', 'active')
     RETURNING id`);
  const otherHousehold = await one<{ id: string }>(
    `INSERT INTO households (display_name, dm_name, cr_area, status)
     VALUES ('W6 fixture onlooker', 'Fixture onlooker', 'westwood', 'active')
     RETURNING id`);
  const kase = await one<{ id: string }>(
    `INSERT INTO cases (household_id, status, care, urgency)
     VALUES ($1, 'active', 'companion', 'routine') RETURNING id`, [household.id]);

  ours = await makeHousehold('w6-ours@example.com', household.id);
  theirs = await makeHousehold('w6-theirs@example.com', otherHousehold.id);

  const eligible = await one<{ id: string; full_name: string }>(
    `SELECT id, full_name FROM providers WHERE full_name = 'Imelda Santoyo'`);
  eligibleId = eligible.id;
  eligibleName = eligible.full_name;
  // Grace Okonkwo's TB clearance lapsed yesterday in the seed.
  lapsedId = (await one<{ id: string }>(
    `SELECT id FROM providers WHERE full_name = 'Grace Okonkwo'`)).id;

  shortlistId = (await one<{ id: string }>(
    `INSERT INTO published_shortlists (case_id, published_by, note)
     VALUES ($1, 'operator', 'Two people we would send.') RETURNING id`, [kase.id])).id;
  await db.query(
    `INSERT INTO published_shortlist_items (shortlist_id, provider_id, position)
     VALUES ($1,$2,1), ($1,$3,2)`,
    [shortlistId, eligibleId, lapsedId]);
});

describe('a request is a request and nothing more', () => {
  it('writes one pending row and creates no referral', async () => {
    const referralsBefore = await rowCount('referrals');
    const disclosuresBefore = await rowCount('disclosures');

    const outcome = await requestProvider(ours, {
      providerId: eligibleId, note: 'Mornings would suit us better.',
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.alreadyAsked).toBe(false);

    const rows = await db.query<{
      status: string; referral_id: string | null; note: string | null;
      requested_by: string; shortlist_id: string;
    }>(
      `SELECT status::text AS status, referral_id, note, requested_by, shortlist_id
         FROM shortlist_requests WHERE id = $1`, [outcome.requestId]);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('pending');
    expect(rows[0]!.referral_id).toBeNull();
    expect(rows[0]!.note).toBe('Mornings would suit us better.');
    expect(rows[0]!.requested_by).toBe(ours.userId);
    expect(rows[0]!.shortlist_id).toBe(shortlistId);

    // The whole point of the milestone.
    expect(await rowCount('referrals')).toBe(referralsBefore);
    expect(await rowCount('disclosures')).toBe(disclosuresBefore);
  });

  it('adds no second row when the same ask arrives twice', async () => {
    const before = await rowCount(
      'shortlist_requests', 'provider_id = $1', [eligibleId]);

    const again = await requestProvider(ours, { providerId: eligibleId });

    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.alreadyAsked).toBe(true);
    expect(await rowCount('shortlist_requests', 'provider_id = $1', [eligibleId]))
      .toBe(before);
  });

  it('reports the open request back to the household that made it', async () => {
    const open = await openRequestFor(ours, eligibleId);
    expect(open).not.toBeNull();
    expect(open!.status).toBe('pending');
    expect(open!.requestedAt.slice(0, 4)).toMatch(/^\d{4}$/);
  });

  it('does not report it to a different household', async () => {
    expect(await openRequestFor(theirs, eligibleId)).toBeNull();
  });

  it('tells the operator that something arrived, and nothing about who', async () => {
    const notes = await db.query<{ kind: string; subject: string; body: string; payload: Record<string, unknown> }>(
      `SELECT kind::text AS kind, subject, body, payload
         FROM operator_notifications
        WHERE kind = 'shortlist_request'
        ORDER BY created_at DESC LIMIT 1`);

    expect(notes).toHaveLength(1);
    const sent = notes[0]!;
    const inbox = `${sent.subject} ${sent.body}`;

    // § 7: no provider name, household name, care recipient name, address or clinical
    // detail in anything that could reach an inbox.
    expect(inbox).not.toContain(eligibleName);
    expect(inbox).not.toContain('W6 fixture household');
    expect(inbox).not.toContain('Fixture decision maker');
    expect(inbox.toLowerCase()).not.toContain('companion');

    // What the console needs is in the payload, which never reaches one.
    expect(sent.payload.providerId).toBe(eligibleId);
    expect(sent.payload.householdId).toBe(ours.householdId);
  });
});

describe('what the action refuses', () => {
  it('refuses a provider whose credential has lapsed, and writes nothing', async () => {
    const before = await rowCount('shortlist_requests');

    const outcome = await requestProvider(ours, { providerId: lapsedId });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe('unavailable');
    expect(await rowCount('shortlist_requests')).toBe(before);
  });

  it('never says why a provider is unavailable', async () => {
    const outcome = await requestProvider(ours, { providerId: lapsedId });
    const serialised = JSON.stringify(outcome).toLowerCase();
    for (const leak of ['expired', 'lapsed', 'missing', 'tb', 'clearance', 'credential']) {
      expect(serialised, `the refusal leaks "${leak}"`).not.toContain(leak);
    }
  });

  it('cannot reach a provider on another household\'s bench, and writes nothing', async () => {
    const before = await rowCount('shortlist_requests');

    const outcome = await requestProvider(theirs, { providerId: eligibleId });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    // Not found rather than forbidden. The distinction leaks less: "forbidden" confirms
    // the provider exists and is on somebody's list.
    expect(outcome.reason).toBe('not_found');
    expect(await rowCount('shortlist_requests')).toBe(before);
  });

  it('is refused once the operator withdraws the list, and writes nothing', async () => {
    await db.query(
      `UPDATE published_shortlists SET withdrawn_at = now() WHERE id = $1`, [shortlistId]);
    const before = await rowCount('shortlist_requests');

    const outcome = await requestProvider(ours, { providerId: eligibleId });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    // Not found, not a distinct "withdrawn" answer. The policy on
    // published_shortlist_items requires a live shortlist, so a withdrawn bench's
    // contents are not visible to the household at all — and reading them under an
    // elevated claim purely to word the refusal better would be working around a
    // decision the policy had just made. See RequestRefusal in lib/request.ts.
    expect(outcome.reason).toBe('not_found');
    expect(await rowCount('shortlist_requests')).toBe(before);

    await db.query(
      `UPDATE published_shortlists SET withdrawn_at = NULL WHERE id = $1`, [shortlistId]);
  });

  it('is refused by the database too, not only by the action', async () => {
    // Defence in depth: the row-level security insert policy requires a live shortlist
    // the household owns, status 'pending' and no referral attached. If the action's own
    // checks were removed tomorrow, this is what would still hold.
    await db.query(
      `UPDATE published_shortlists SET withdrawn_at = now() WHERE id = $1`, [shortlistId]);

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
          `INSERT INTO shortlist_requests (shortlist_id, provider_id, requested_by)
           VALUES ($1, $2, $3)`,
          [shortlistId, eligibleId, ours.userId]);
      });
    } catch {
      denied = true;
    }
    expect(denied, 'the policy allowed an insert against a withdrawn shortlist').toBe(true);

    await db.query(
      `UPDATE published_shortlists SET withdrawn_at = NULL WHERE id = $1`, [shortlistId]);
  });
});

// ---------------------------------------------------------------------------
// The static gate. § 11: no code path from (client) reaches referrals.
// ---------------------------------------------------------------------------

/** Every module reachable from `app/(client)`, transitively, stopping at packages. */
function clientReachable(): string[] {
  return reachableFrom(walk(path.join(ROOT, 'app', '(client)')));
}

const RESTRICTED = ['referrals', 'timeline_entries', 'disclosures'];

/**
 * Matches the table being QUERIED, not the English word.
 *
 * The first version of this matched the bare word and tripped on
 * content/statutory/nurses-registry-disclosure.ts, which contains "referrals" because
 * the statute does. Exempting that file would have been the wrong fix: the invariant
 * is about reaching the table, so the matcher should describe reaching the table.
 */
function touches(table: string): RegExp {
  return new RegExp(
    String.raw`\b(?:from|join|into|update|delete\s+from)\s+(?:only\s+)?"?${table}"?\b`,
    'i',
  );
}

describe('no code path from (client) reaches the referral record', () => {
  const reachable = clientReachable();

  it('walked a graph that actually includes the request path', () => {
    // Guards the guard. A resolver that silently found nothing would make every
    // assertion below pass against an empty set.
    const relative = reachable.map((f) => path.relative(ROOT, f));
    expect(relative).toContain('lib/request.ts');
    expect(relative).toContain('lib/portal.ts');
    expect(relative).toContain('components/RequestProvider.tsx');
    expect(relative.length).toBeGreaterThan(8);
  });

  it('writes to none of the statutory tables', () => {
    const write = new RegExp(
      String.raw`\b(?:insert\s+into|update|delete\s+from)\s+(?:only\s+)?"?(${RESTRICTED.join('|')})"?\b`,
      'i',
    );
    for (const file of reachable) {
      const found = write.exec(code(file));
      expect(found, `${path.relative(ROOT, file)} writes to ${found?.[1]}`).toBeNull();
    }
  });

  it('reads them only from the two modules entitled to, and nowhere else', () => {
    /*
     * W6 asserted the strong form: nothing reachable from app/(client) so much as
     * named these tables. W7 narrows it, deliberately and exactly twice.
     *
     *   lib/feedback.ts   reads ONE referral, to confirm it belongs to this household
     *                     before taking feedback on it. § 4.1,
     *                     /portal/feedback/[referralId]. `referrals_household_select`
     *                     already grants precisely that.
     *   lib/documents.ts  reads the household's own `disclosures`, so they can see
     *                     which statutory documents they have had and when. A record
     *                     its subject can check is a stronger record than one only the
     *                     registry holds.
     *
     * Everything else is still refused, and the write gate above is untouched and
     * permanent. This list is the point of the test: adding a third reader fails here,
     * which is where that decision should be taken rather than in a diff nobody
     * reviewed.
     */
    const MAY_READ: Record<string, readonly string[]> = {
      'lib/feedback.ts': ['referrals'],
      'lib/documents.ts': ['disclosures'],
    };

    for (const file of reachable) {
      const relative = path.relative(ROOT, file);
      const allowed = MAY_READ[relative] ?? [];
      const src = code(file);
      for (const table of RESTRICTED) {
        if (allowed.includes(table)) continue;
        expect(
          touches(table).test(src),
          `${relative} queries ${table}, and is not on the list of modules that may`,
        ).toBe(false);
      }
    }
  });

  it('the allowance is real — those two modules are reachable and do read', () => {
    // Guards the allowance. If feedback.ts fell out of the graph, the exemption above
    // would be dead text and the next reader would trust a gate that checks nothing.
    const relative = reachable.map((f) => path.relative(ROOT, f));
    expect(relative).toContain('lib/feedback.ts');
    expect(relative).toContain('lib/documents.ts');
    expect(touches('referrals').test(code(path.join(ROOT, 'lib/feedback.ts')))).toBe(true);
    expect(touches('disclosures').test(code(path.join(ROOT, 'lib/documents.ts')))).toBe(true);
  });

  it('neither of them writes, which is the gate that does not move', () => {
    const write = new RegExp(
      String.raw`\b(?:insert\s+into|update|delete\s+from)\s+(?:only\s+)?"?(${RESTRICTED.join('|')})"?\b`,
      'i',
    );
    for (const rel of ['lib/feedback.ts', 'lib/documents.ts']) {
      expect(write.exec(code(path.join(ROOT, rel))), `${rel} writes to a statutory table`)
        .toBeNull();
    }
  });
});

describe('the copy says request, never a placement', () => {
  const REQUEST_PATH = [
    'lib/requestState.ts',
    'lib/request.ts',
    'components/RequestProvider.tsx',
    'app/(client)/portal/provider/[id]/actions.ts',
  ];

  it('uses no language of booking, holding or confirming on the request path', () => {
    // Strict here, because this is the surface a household reads at the moment it asks.
    // "Confirmed" would describe something that has not happened and cannot happen
    // without an operator on the phone.
    const banned = /\b(book|books|booked|booking|bookings|reserve|reserved|reservation|confirm|confirms|confirmed|confirming|confirmation|appointment|appointments|slot|slots|hired|placement|placed|assigned)\b/i;
    for (const rel of REQUEST_PATH) {
      const found = banned.exec(code(path.join(ROOT, rel)));
      expect(found, `${rel} says "${found?.[0]}"`).toBeNull();
    }
  });

  it('uses none of the unambiguous booking words anywhere under (client)', () => {
    // Deliberately narrower than the list above. Elsewhere in the portal "confirmed"
    // is credential language — "Registered nurse licence, confirmed 2026-04-12" — which
    // is a fact about a document, not a claim about an arrangement. Banning it across
    // the whole tree would push that copy into something vaguer for no gain.
    const banned = /\b(booked|booking|bookings|reserved|reservation|placement|hired)\b/i;
    for (const file of walk(path.join(ROOT, 'app', '(client)'))) {
      const found = banned.exec(code(file));
      expect(found, `${path.relative(ROOT, file)} says "${found?.[0]}"`).toBeNull();
    }
  });
});
