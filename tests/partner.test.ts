/**
 * W11 — the partner surface. Web build spec § 4.3 and § 0.1.
 *
 * The milestone's two gates: no account is needed for a first referral, and no
 * compensation field exists in schema or UI.
 *
 * The second one is the load-bearing half. § 1812.531 prohibits a nurses' registry
 * dividing fees with "any physician, surgeon, nurse, hospital, patient, or their
 * agents or employees" — which is most of the people this portal is for. § 0.1 is
 * explicit that there must be "no schema column that could hold one", so the
 * assertions below look at the database and at every file on this surface, not at
 * whether a form happens to render a field today.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DbHandle } from '@h-hallows/core/db';
import { seededDb } from '@h-hallows/core/testing';
import { OUTCOME_NOTE, partnerReferrals, referralStanding } from '@/lib/partner';
import { recordPartnerReferral } from '@/lib/intake';
import { PartnerReferralSchema } from '@/lib/schemas/intake';
import { ROOT, code, rel, walk } from './importGraph';
import type { PortalSession } from '@/lib/session';

let db: DbHandle;
let partnerId: string;
let otherPartnerId: string;
let mine: PortalSession;
let theirs: PortalSession;
let householdId: string;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const [row] = await db.query<T>(sql, params);
  if (!row) throw new Error(`fixture query returned no rows: ${sql}`);
  return row;
}

async function makePartner(email: string, id: string): Promise<PortalSession> {
  const user = await one<{ id: string }>(
    `INSERT INTO users (email, display_name, role) VALUES ($1, $2, 'partner')
     ON CONFLICT (email) DO UPDATE SET role = 'partner' RETURNING id`,
    [email, email.split('@')[0]],
  );
  await db.query(
    `INSERT INTO partner_users (user_id, partner_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [user.id, id],
  );
  return {
    userId: user.id, email, displayName: email, role: 'partner',
    householdId: null, providerId: null, partnerId: id,
  };
}

beforeAll(async () => {
  db = await seededDb();
  partnerId = (await one<{ id: string }>(
    `INSERT INTO referral_partners (name, org, role)
     VALUES ('W11 Planner', 'A Hospital', 'discharge_planner') RETURNING id`)).id;
  otherPartnerId = (await one<{ id: string }>(
    `INSERT INTO referral_partners (name, org, role)
     VALUES ('W11 Other', 'Another Hospital', 'discharge_planner') RETURNING id`)).id;
  householdId = (await one<{ id: string }>(`SELECT id FROM households LIMIT 1`)).id;

  mine = await makePartner('w11-mine@example.com', partnerId);
  theirs = await makePartner('w11-theirs@example.com', otherPartnerId);
});

describe('a first referral needs no account', () => {
  const valid = {
    partnerName: 'A Planner',
    partnerOrg: 'A Hospital',
    partnerRole: 'discharge_planner' as const,
    partnerPhone: '(310) 555-0100',
    partnerEmail: 'planner@example.com',
    patientInitials: 'J.T.',
    careType: 'post_surgical' as const,
    area: 'brentwood',
    urgency: 'discharge' as const,
    contactName: 'A Daughter',
    contactPhone: '(310) 555-0101',
    consentNote: true as const,
  };

  it('the schema takes a referral with no account on it', () => {
    const parsed = PartnerReferralSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('records it without creating a household, case or provider', async () => {
    const before = await one<{ h: string; c: string; p: string }>(
      `SELECT (SELECT count(*) FROM households)::text AS h,
              (SELECT count(*) FROM cases)::text AS c,
              (SELECT count(*) FROM providers)::text AS p`);

    const id = await recordPartnerReferral(valid);
    expect(id).toBeTruthy();

    const after = await one<{ h: string; c: string; p: string }>(
      `SELECT (SELECT count(*) FROM households)::text AS h,
              (SELECT count(*) FROM cases)::text AS c,
              (SELECT count(*) FROM providers)::text AS p`);
    expect(after).toEqual(before);
  });

  it('keeps initials and never asks for the patient\'s name', async () => {
    const row = await one<{ referrer: Record<string, unknown> }>(
      `SELECT referrer FROM inquiries WHERE referrer ->> 'patientInitials' = 'J.T.'
        ORDER BY received_at DESC LIMIT 1`);
    expect(row.referrer.patientInitials).toBe('J.T.');
    expect(Object.keys(row.referrer)).not.toContain('patientName');
  });

  it('refuses one where the family has not agreed', () => {
    const parsed = PartnerReferralSchema.safeParse({ ...valid, consentNote: false });
    expect(parsed.success).toBe(false);
  });
});

describe('what a partner is shown about their own referrals', () => {
  let converted: string;

  beforeAll(async () => {
    await db.query(
      `INSERT INTO inquiries (name, phone, area, urgency, partner_id, referrer)
       VALUES ('A Daughter', '310', 'brentwood', 'discharge', $1,
               '{"patientInitials":"K.L."}'::jsonb)`, [partnerId]);
    converted = (await one<{ id: string }>(
      `INSERT INTO inquiries (name, phone, area, urgency, partner_id, household_id, referrer, handled_at)
       VALUES ('A Son', '310', 'bel_air', 'routine', $1, $2,
               '{"patientInitials":"M.N."}'::jsonb, now())
       RETURNING id`, [partnerId, householdId])).id;
    await db.query(
      `INSERT INTO inquiries (name, phone, area, urgency, partner_id, referrer)
       VALUES ('Not Yours', '310', 'malibu', 'routine', $1,
               '{"patientInitials":"X.Y."}'::jsonb)`, [otherPartnerId]);
  });

  it('shows their own and not another partner\'s', async () => {
    const theirInitials = (await partnerReferrals(mine)).map((r) => r.patientInitials);
    expect(theirInitials).toContain('K.L.');
    expect(theirInitials).toContain('M.N.');
    expect(theirInitials).not.toContain('X.Y.');
  });

  it('says nothing about the outcome without the household\'s consent', async () => {
    const row = (await partnerReferrals(mine)).find((r) => r.patientInitials === 'M.N.');
    // It has been converted — the household_id is set — and the partner is not told.
    expect(row!.outcome).toBeNull();
    expect(referralStanding(row!)).toBe('We have spoken to them');
  });

  it('says so once the household consents, and stops when it is withdrawn', async () => {
    await db.query(
      `INSERT INTO consents (subject_type, subject_id, kind, granted_at, granted_by)
       VALUES ('household', $1, 'partner_outcome', now(), 'operator')`, [householdId]);
    let row = (await partnerReferrals(mine)).find((r) => r.patientInitials === 'M.N.');
    expect(row!.outcome).toBe('care_arranged');
    expect(referralStanding(row!)).toBe('Care was arranged');

    await db.query(
      `UPDATE consents SET revoked_at = now()
        WHERE subject_type = 'household' AND subject_id = $1 AND kind = 'partner_outcome'`,
      [householdId]);
    row = (await partnerReferrals(mine)).find((r) => r.patientInitials === 'M.N.');
    expect(row!.outcome).toBeNull();
  });

  it('carries no household or patient name', async () => {
    const serialised = JSON.stringify(await partnerReferrals(mine)).toLowerCase();
    for (const leak of ['household_id', 'householdid', 'payment', 'ltc_policy']) {
      expect(serialised, `the partner view leaks "${leak}"`).not.toContain(leak);
    }
  });

  it('shows a partner with no referrals nothing at all', async () => {
    const empty = await makePartner('w11-empty@example.com', otherPartnerId);
    const rows = await partnerReferrals(empty);
    expect(rows.every((r) => r.patientInitials !== 'K.L.')).toBe(true);
  });

  it('gives dates in the same ISO form as the rest of the portal', () => {
    // Guards a real slip: SELECT * returns a Date for a timestamptz, and
    // String(date).slice(0, 10) is "Thu Nov 05" rather than "2026-11-05". It rendered
    // beside ISO dates everywhere else and would not survive being parsed.
    return partnerReferrals(mine).then((rows) => {
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(r.receivedOn, 'receivedOn').toMatch(/^\d{4}-\d{2}-\d{2}$/);
        if (r.acknowledgedOn) {
          expect(r.acknowledgedOn, 'acknowledgedOn').toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    });
  });

  it('explains the limit rather than leaving it unexplained', () => {
    expect(OUTCOME_NOTE).toMatch(/withdrawn at any time/i);
  });
});

describe('there is nowhere to put a referral payment', () => {
  const MONEY_WORDS = /\b(commission|compensation|bonus|rewards?|payout|kickback|incentive|finder'?s fee|rebate|referral fee|revenue share|fee split)\b/i;

  const SURFACE = () => [
    ...walk(path.join(ROOT, 'app', '(partner)')),
    path.join(ROOT, 'app/(marketing)/refer/page.tsx'),
    path.join(ROOT, 'components/PartnerReferralForm.tsx'),
    path.join(ROOT, 'lib/partner.ts'),
    path.join(ROOT, 'lib/intake.ts'),
    path.join(ROOT, 'lib/schemas/intake.ts'),
    path.join(ROOT, 'app/api/refer/route.ts'),
  ];

  it('no column in the database could hold one', async () => {
    const rows = await db.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND column_name ~* 'commission|compensat|bonus|reward|payout|kickback|incentive|finder|rebate|partner_fee|revenue'`);
    expect(rows.map((r) => `${r.table_name}.${r.column_name}`)).toEqual([]);
  });

  it('the referral schema has no field for one', () => {
    const shape = Object.keys(PartnerReferralSchema.shape);
    for (const field of shape) {
      expect(MONEY_WORDS.test(field), `the schema has a "${field}" field`).toBe(false);
    }
    // And being .strict(), it rejects one smuggled in.
    const parsed = PartnerReferralSchema.safeParse({
      partnerName: 'A Planner', partnerOrg: 'A Hospital',
      partnerRole: 'physician', partnerPhone: '(310) 555-0100',
      partnerEmail: 'p@example.com', patientInitials: 'A.B.',
      careType: 'post_surgical', area: 'brentwood', urgency: 'routine',
      contactName: 'A Son', contactPhone: '(310) 555-0101', consentNote: true,
      commission: 500,
    });
    expect(parsed.success).toBe(false);
  });

  it('no file on the partner surface offers one', () => {
    for (const file of SURFACE()) {
      const src = code(file);
      // Copy that DENIES payment is the point of the page, so the ban is on the
      // mechanics rather than the words: a field, a column, a number, a currency.
      const offers = /(?:name|id|htmlFor|value)=["'][^"']*(?:commission|bonus|reward|payout|rebate|incentive)/i;
      const found = offers.exec(src);
      expect(found, `${rel(file)} renders a payment field: "${found?.[0]}"`).toBeNull();
    }
  });

  it('says plainly that there is no payment, where a partner will read it', () => {
    const refer = code(path.join(ROOT, 'app/(marketing)/refer/page.tsx'));
    const portal = code(path.join(ROOT, 'app/(partner)/partner/page.tsx'));
    for (const [where, src] of [['/refer', refer], ['/partner', portal]] as const) {
      expect(src, `${where} does not mention that there is no payment`)
        .toMatch(/no payment|not pay for referrals|no commission/i);
    }
  });
});

/**
 * A partner's own referrals reach their own portal.
 *
 * `partner_referrals()` is scoped by `inquiries.partner_id`, and
 * `recordPartnerReferral` never set it — so every referral a partner sent was invisible
 * to them, on a page that says "Nothing yet. When you send us a patient it will appear
 * here with where it has got to." Reproduced against the running application before it
 * was fixed: the row landed with partner_id NULL and the partner's email sitting in a
 * JSON blob nothing reads.
 */
describe('attributing a referral to the partner who sent it', () => {
  const REFERRAL = {
    partnerName: 'Dolores Hwang',
    partnerOrg: 'Huntington Hospital',
    partnerRole: 'discharge_planner' as const,
    partnerPhone: '(626) 555-0100',
    partnerEmail: 'planner@example.com',
    patientInitials: 'R.K.',
    contactName: 'Ruth Keating',
    contactPhone: '(626) 555-7788',
    careType: 'post_surgical' as const,
    area: 'pasadena',
    urgency: 'discharge' as const,
    consentNote: true as const,
    note: 'Discharging Friday.',
  };

  it('a signed-in partner sees what they sent', async () => {
    const before = await partnerReferrals(mine);

    const id = await recordPartnerReferral(REFERRAL, mine);

    const [row] = await db.query<{ partner_id: string | null }>(
      `SELECT partner_id FROM inquiries WHERE id = $1`, [id]);
    expect(row!.partner_id).toBe(mine.partnerId);

    const after = await partnerReferrals(mine);
    expect(after.length).toBe(before.length + 1);
    expect(after.some((r) => r.inquiryId === id)).toBe(true);
  });

  it('without a session it stays unattributed, rather than guessing from the email', async () => {
    /*
     * The email in the form is typed by whoever is filling it in. Matching on it would
     * let anyone claim another partner's referrals — and `partner_id` is exactly what
     * decides who may read an outcome later. An operator attaches these by hand.
     */
    const id = await recordPartnerReferral(REFERRAL);

    const [row] = await db.query<{ partner_id: string | null; email: string }>(
      `SELECT partner_id, referrer->>'partnerEmail' AS email FROM inquiries WHERE id = $1`,
      [id]);
    expect(row!.email).toBe('planner@example.com');
    expect(row!.partner_id).toBeNull();

    expect((await partnerReferrals(mine)).some((r) => r.inquiryId === id))
      .toBe(false);
  });

  it('a partner cannot attribute a referral to a different partner', async () => {
    // The policy from 0014 permits `partner_id = current_partner()` and nothing else,
    // so a forged session claim is refused by the database rather than trusted here.
    await expect(recordPartnerReferral(
      REFERRAL,
      { ...mine, partnerId: otherPartnerId },
    )).rejects.toThrow();
  });
});

/**
 * /refer reads the request, so it must not be statically rendered.
 *
 * This failure is invisible where you would look for it: in development every page is
 * rendered per request, so the prefill works perfectly, and in production the page is
 * baked at build time with no cookie in it and a signed-in partner sees a blank form
 * forever. Next says so by throwing a dynamic-usage error during the build — which the
 * page's own try/catch swallowed into a log line on the first attempt at this.
 */
describe('the refer page is rendered per request', () => {
  const page = readFileSync(path.join(ROOT, 'app/(marketing)/refer/page.tsx'), 'utf8');

  it('declares itself dynamic', () => {
    expect(page).toContain("export const dynamic = 'force-dynamic'");
  });

  it('reads the session, which is what makes it dynamic', () => {
    expect(page).toContain('getPortalSession()');
    expect(page).toContain('partnerIdentity(');
  });

  it('re-throws the framework\'s own control flow before handling an error', () => {
    /*
     * `unstable_rethrow` first, in every catch that wraps a Next API. redirect(),
     * notFound() and dynamic-usage are all signalled by throwing, and a catch that
     * keeps them turns a framework instruction into a logged warning.
     */
    for (const file of ['app/(marketing)/refer/page.tsx', 'app/api/refer/route.ts']) {
      const source = readFileSync(path.join(ROOT, file), 'utf8');
      const catchAt = source.indexOf('} catch (err) {');
      expect(catchAt, `${file} has no catch to check`).toBeGreaterThan(-1);
      const handler = source.slice(catchAt, catchAt + 400);
      expect(handler, `${file} swallows Next's control flow`)
        .toContain('unstable_rethrow(err)');
    }
  });
});
