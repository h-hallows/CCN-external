/**
 * Portal sessions for the three signed-in audiences.
 *
 * Architecture spec § 4 puts these on Supabase Auth. Supabase is not provisioned, so
 * this uses the same mechanism the console already has — a single-use invite token, a
 * hashed session row, an httpOnly cookie — and produces the same JWT-shaped claims the
 * RLS policies in migration 0003 read.
 *
 * That is the point of having made the policies read `request.jwt.claims` rather than
 * calling Supabase's auth.jwt() directly: the authority that issues a claim is
 * swappable, and nothing in the database layer changes when it is swapped.
 */
import { createHash, randomBytes } from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { getDb } from '@h-hallows/core/db';

export const PORTAL_COOKIE = 'ccn_portal';
const SESSION_TTL_DAYS = 14;

export type PortalRole = 'household' | 'provider' | 'partner';

export interface PortalSession {
  userId: string;
  email: string;
  displayName: string;
  role: PortalRole;
  householdId: string | null;
  providerId: string | null;
  partnerId: string | null;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/*
 * `tokensMatch` USED TO BE HERE, AND IS GONE.
 *
 * It was an exported constant-time compare that nothing in the application, and
 * nothing in the suite, ever called. Every token comparison in this file and in
 * `app/invite/[token]` is SQL equality on a SHA-256 hash — `WHERE token_hash = $1` —
 * which is the standard pattern: the compared values are digests, so what a timing
 * difference between two of them reveals is nothing about either preimage.
 *
 * A previous pass judged it misleading rather than exploitable and left it. That
 * judgement was right about the risk and the thing was still worth removing, because
 * what a dead exported helper does is get imported. It sat in the module a reader goes
 * to when they want to know how a token is checked, named as though it were the
 * answer, and it was not even correct as written: the `x.length === y.length &&`
 * short-circuit in front of `timingSafeEqual` is itself a timing branch, so the one
 * property its name promises was the one property it did not have.
 *
 * tests/sessionShape.test.ts asserts the absence as a rule: no bespoke token
 * comparison in this module, and the lookup stays an equality on a hash.
 */

/**
 * The claims this session carries into the database. Shape matches what
 * `current_role_name()`, `current_household()` and `current_provider()` read.
 */
export function claimsFor(session: PortalSession): Record<string, string> {
  const claims: Record<string, string> = {
    ccn_role: session.role,
    ccn_user_id: session.userId,
  };
  if (session.householdId) claims.ccn_household_id = session.householdId;
  if (session.providerId) claims.ccn_provider_id = session.providerId;
  if (session.partnerId) claims.ccn_partner_id = session.partnerId;
  return claims;
}

/*
 * WHY THE IDENTITY QUERY BELOW ORDERS ITS MEMBERSHIP JOINS.
 *
 * `household_users` is keyed on (user_id, household_id) and `partner_users` on
 * (user_id, partner_id) — both MANY-TO-ONE on the user, deliberately: a daughter
 * arranging care for two parents in separate households is the ordinary case, and so
 * is a discharge planner who moved hospital. Those LEFT JOINs therefore produce one
 * row per membership, and `LIMIT 1` keeps one of them.
 *
 * Without an ORDER BY, WHICH one is whatever the planner hands back, and that is free
 * to differ between two renders of the same page. So a household with two cases could
 * see one parent's short list on one request and the other parent's on the next, with
 * nothing on the screen saying which.
 *
 * The ORDER BY makes the choice stable. It does not make it RIGHT: the session can
 * still only carry one subject per role, because `current_household()` returns a
 * single uuid and the § 4 policies compare against it. Carrying a set needs that
 * function and those policies to take one, which is a core migration and not this
 * repository's to write. Reported rather than worked around — widening what a
 * household sees from a WHERE clause here would be stepping around the policies
 * instead of fixing them.
 */
/**
 * The current session, or null.
 *
 * Reads as the operator because it has to look across tables a household cannot see —
 * which is exactly why it returns nothing but identity, and why every query that
 * touches real data goes through `asPortalUser` instead.
 *
 * WRAPPED IN React's `cache`, which deduplicates it per request. Every portal layout
 * calls this and then every page calls it again, so each authenticated render was
 * issuing the same five-table join two or three times — /pro/resume three, because its
 * generateMetadata needs it too. Next deduplicates `fetch`, not database calls, so
 * nothing was doing this for us.
 */
export const getPortalSession = cache(async (): Promise<PortalSession | null> => {
  const jar = await cookies();
  const token = jar.get(PORTAL_COOKIE)?.value;
  if (!token) return null;

  const { query } = await getDb();
  const [row] = await query<{
    user_id: string; email: string; display_name: string; role: string;
    household_id: string | null; provider_id: string | null; partner_id: string | null;
    disabled_at: string | null;
  }>(
    `SELECT u.id AS user_id, u.email, u.display_name, u.role::text AS role, u.disabled_at,
            hu.household_id, pu.provider_id, ru.partner_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN household_users hu ON hu.user_id = u.id
       LEFT JOIN provider_users pu ON pu.user_id = u.id
       LEFT JOIN partner_users ru ON ru.user_id = u.id
      WHERE s.token_hash = $1 AND s.expires_at > now()
      -- ORDER BY: see the note above. Deterministic, not correct.
      ORDER BY hu.household_id, pu.provider_id, ru.partner_id
      LIMIT 1`,
    [hashToken(token)],
  );

  if (!row || row.disabled_at) return null;
  if (row.role === 'operator') return null;   // the console is a different application

  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role as PortalRole,
    householdId: row.household_id,
    providerId: row.provider_id,
    partnerId: row.partner_id,
  };
});

/**
 * Replaces any session for this user, then issues a new one.
 *
 * The delete is the point. Without it a user accumulated a live `sessions` row per
 * sign-in for fourteen days each, with no way to end any of them — `endSession` was
 * written and never called from anywhere.
 */
export async function startSession(userId: string): Promise<void> {
  const token = newToken();
  const { query } = await getDb();
  await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
  await query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 || ' days')::interval)`,
    [userId, hashToken(token), String(SESSION_TTL_DAYS)],
  );
  await query(`UPDATE users SET last_seen_at = now() WHERE id = $1`, [userId]);

  const jar = await cookies();
  jar.set(PORTAL_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 86_400,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(PORTAL_COOKIE)?.value;
  if (token) {
    const { query } = await getDb();
    await query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
  }
  jar.delete(PORTAL_COOKIE);
}
