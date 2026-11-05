/**
 * Self-service sign-in issues an invite that names what it lets you into.
 *
 * This is a regression test for a live breakage. `/login` inserted a `portal_invites`
 * row carrying the user's role and all three subject ids NULL, while
 * `portal_invite_names_its_subject` requires a household invite to carry a
 * household_id, a provider invite a provider_id and — since migration 0012 — a partner
 * invite a partner_id. So typing your own email into the page raised a constraint
 * violation instead of sending a link: households and providers before 0012, every
 * portal role after it.
 *
 * The test runs the statement the page runs, against the real constraint, for each
 * role — which is the only way to catch this, since nothing in TypeScript knows about
 * a CHECK.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { DbHandle } from '@h-hallows/core/db';
import { seededDb } from '@h-hallows/core/testing';

let db: DbHandle;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const [row] = await db.query<T>(sql, params);
  if (!row) throw new Error(`fixture query returned no rows: ${sql}`);
  return row;
}

/** Exactly the statement in app/login/page.tsx. */
const ISSUE_INVITE = `
  INSERT INTO portal_invites
    (email, role, household_id, provider_id, partner_id,
     token_hash, issued_by, expires_at)
  SELECT u.email, u.role, hu.household_id, pu.provider_id, ru.partner_id,
         $2, 'self-service', now() + interval '15 minutes'
    FROM users u
    LEFT JOIN household_users hu ON hu.user_id = u.id
    LEFT JOIN provider_users pu ON pu.user_id = u.id
    LEFT JOIN partner_users ru ON ru.user_id = u.id
   WHERE u.id = $1
     AND ((u.role = 'household' AND hu.household_id IS NOT NULL)
       OR (u.role = 'provider'  AND pu.provider_id  IS NOT NULL)
       OR (u.role = 'partner'   AND ru.partner_id   IS NOT NULL))
  RETURNING role::text AS role, household_id, provider_id, partner_id`;

beforeAll(async () => {
  db = await seededDb();
});

describe('a portal user can ask for their own sign-in link', () => {
  it('issues a household invite naming the household', async () => {
    const household = await one<{ id: string }>(`SELECT id FROM households LIMIT 1`);
    const user = await one<{ id: string }>(
      `INSERT INTO users (email, display_name, role)
       VALUES ('login-household@example.com', 'A household', 'household')
       ON CONFLICT (email) DO UPDATE SET role = 'household' RETURNING id`);
    await db.query(
      `INSERT INTO household_users (user_id, household_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`, [user.id, household.id]);

    const row = await one<{ role: string; household_id: string | null }>(
      ISSUE_INVITE, [user.id, 'login-test-household']);
    expect(row.role).toBe('household');
    expect(row.household_id).toBe(household.id);
  });

  it('issues a provider invite naming the provider', async () => {
    const provider = await one<{ id: string }>(`SELECT id FROM providers LIMIT 1`);
    const user = await one<{ id: string }>(
      `INSERT INTO users (email, display_name, role)
       VALUES ('login-provider@example.com', 'A provider', 'provider')
       ON CONFLICT (email) DO UPDATE SET role = 'provider' RETURNING id`);
    await db.query(
      `INSERT INTO provider_users (user_id, provider_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`, [user.id, provider.id]);

    const row = await one<{ role: string; provider_id: string | null }>(
      ISSUE_INVITE, [user.id, 'login-test-provider']);
    expect(row.role).toBe('provider');
    expect(row.provider_id).toBe(provider.id);
  });

  it('issues a partner invite naming the partner', async () => {
    const partner = await one<{ id: string }>(
      `INSERT INTO referral_partners (name) VALUES ('Login Test Partner') RETURNING id`);
    const user = await one<{ id: string }>(
      `INSERT INTO users (email, display_name, role)
       VALUES ('login-partner@example.com', 'A partner', 'partner')
       ON CONFLICT (email) DO UPDATE SET role = 'partner' RETURNING id`);
    await db.query(
      `INSERT INTO partner_users (user_id, partner_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`, [user.id, partner.id]);

    const row = await one<{ role: string; partner_id: string | null }>(
      ISSUE_INVITE, [user.id, 'login-test-partner']);
    expect(row.role).toBe('partner');
    expect(row.partner_id).toBe(partner.id);
  });

  it('issues nothing when the role and the membership disagree', async () => {
    // A household user with no household_users row. The page still tells the visitor a
    // link was sent, because saying otherwise would reveal which families use us.
    const user = await one<{ id: string }>(
      `INSERT INTO users (email, display_name, role)
       VALUES ('login-orphan@example.com', 'Orphan', 'household')
       ON CONFLICT (email) DO UPDATE SET role = 'household' RETURNING id`);
    const rows = await db.query(ISSUE_INVITE, [user.id, 'login-test-orphan']);
    expect(rows).toEqual([]);
  });

  it('the old statement would still be refused, so this test is not vacuous', async () => {
    const user = await one<{ id: string }>(
      `SELECT id FROM users WHERE email = 'login-household@example.com'`);
    let denied = false;
    try {
      await db.query(
        `INSERT INTO portal_invites (email, role, token_hash, issued_by, expires_at)
         SELECT email, role, 'login-test-old', 'self-service', now() + interval '15 minutes'
           FROM users WHERE id = $1`, [user.id]);
    } catch { denied = true; }
    expect(denied, 'the constraint no longer catches the original bug').toBe(true);
  });
});
