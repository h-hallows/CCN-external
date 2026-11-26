/**
 * `lib/session.ts` — the module every authenticated surface starts from.
 *
 * Three properties, each a rule rather than an instance.
 *
 * 1. THE TOKEN IS LOOKED UP, NEVER COMPARED IN JAVASCRIPT. The module exported a
 *    `tokensMatch` constant-time compare that nothing called, standing in the place a
 *    reader looks to find out how a token is checked. The real check is SQL equality
 *    on a SHA-256 hash, which is correct and is the thing to keep.
 *
 * 2. THE CLAIMS CARRY THE ROLE AND THE SUBJECT, AND NOTHING ELSE. `claimsFor` is what
 *    the § 4 policies read. Anything that found its way in there would be a fact the
 *    database would then believe.
 *
 * 3. THE SUBJECT IS RESOLVED DETERMINISTICALLY. Two of the three membership tables are
 *    many-to-one on the user, so the identity join can return several rows and the
 *    query keeps one. Which one must at least not change between requests.
 *
 * And one rule about the module's neighbours: nothing else in the portal may reach the
 * database without going through `lib/portalDb.ts`. tests/portal.test.ts holds that
 * list; what is added here is that the list is matched on a REFERENCE to `getDb`
 * rather than on the exact spelling `await getDb()`, which a caller can trivially
 * avoid writing.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { DbHandle } from '@h-hallows/core/db';
import { seededDb } from '@h-hallows/core/testing';
import { ROOT, code, rel } from './importGraph';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k) } : undefined),
    set: (k: string, v: string) => { jar.set(k, v); },
    delete: (k: string) => { jar.delete(k); },
  }),
  headers: async () => new Headers(),
}));

const SESSION_SRC = code(path.join(ROOT, 'lib/session.ts'));

let db: DbHandle;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const [row] = await db.query<T>(sql, params);
  if (!row) throw new Error(`fixture query returned no rows: ${sql}`);
  return row;
}

beforeAll(async () => { db = await seededDb(); });

// ---------------------------------------------------------------------------

describe('a token is looked up, not compared in this process', () => {
  it('the module exports no bespoke token comparison', async () => {
    const mod = await import('@/lib/session') as Record<string, unknown>;
    const comparers = Object.keys(mod).filter((k) => /match|compare|equal|verify/i.test(k));
    expect(
      comparers,
      `${comparers.join(', ')} — a comparison helper in this module is where a reader `
      + 'looks to find out how a token is checked. The check is SQL equality on a '
      + 'SHA-256 hash; anything else here will be imported by somebody.',
    ).toEqual([]);
  });

  it('and uses no constant-time primitive, because it has nothing to use one on', () => {
    for (const primitive of ['timingSafeEqual', 'crypto.subtle', 'scryptSync']) {
      expect(SESSION_SRC, `lib/session.ts still reaches for ${primitive}`)
        .not.toContain(primitive);
    }
  });

  it('the lookup is an equality on a hash of the cookie, not on the cookie', () => {
    expect(SESSION_SRC).toMatch(/token_hash\s*=\s*\$1/);
    expect(SESSION_SRC).toMatch(/\[hashToken\(token\)\]/);
    // sha256, and nothing weaker.
    expect(SESSION_SRC).toMatch(/createHash\('sha256'\)/);
  });

  it('a token that differs from a live one by one character opens nothing', async () => {
    const { hashToken, getPortalSession } = await import('@/lib/session');
    const household = await one<{ id: string }>(
      `SELECT id FROM households ORDER BY created_at, id LIMIT 1`);
    const user = await one<{ id: string }>(
      `INSERT INTO users (email, display_name, role)
       VALUES ('shape-near@example.com', 'Near', 'household')
       ON CONFLICT (email) DO UPDATE SET role = 'household' RETURNING id`);
    await db.query(
      `INSERT INTO household_users (user_id, household_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`, [user.id, household.id]);
    await db.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1,$2, now() + interval '1 day')
       ON CONFLICT (token_hash) DO NOTHING`, [user.id, hashToken('shape-token-aaaa')]);

    jar.clear();
    jar.set('ccn_portal', 'shape-token-aaab');
    expect(await getPortalSession()).toBeNull();
    jar.set('ccn_portal', 'shape-token-aaaa');
    expect((await getPortalSession())?.email).toBe('shape-near@example.com');
  });

  it('an expired row is not a session, and a disabled user is not either', async () => {
    const { hashToken, getPortalSession } = await import('@/lib/session');
    const user = await one<{ id: string }>(
      `SELECT id FROM users WHERE email = 'shape-near@example.com'`);

    await db.query(`DELETE FROM sessions WHERE user_id = $1`, [user.id]);
    await db.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1,$2, now() - interval '1 second')`, [user.id, hashToken('shape-stale')]);
    jar.set('ccn_portal', 'shape-stale');
    expect(await getPortalSession()).toBeNull();

    await db.query(`DELETE FROM sessions WHERE user_id = $1`, [user.id]);
    await db.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1,$2, now() + interval '1 day')`, [user.id, hashToken('shape-live')]);
    await db.query(`UPDATE users SET disabled_at = now() WHERE id = $1`, [user.id]);
    jar.set('ccn_portal', 'shape-live');
    expect(await getPortalSession()).toBeNull();
    await db.query(`UPDATE users SET disabled_at = NULL WHERE id = $1`, [user.id]);
  });

  it('an operator is not a portal user, whatever their session row says', async () => {
    const { hashToken, getPortalSession } = await import('@/lib/session');
    const op = await one<{ id: string }>(
      `INSERT INTO users (email, display_name, role)
       VALUES ('shape-operator@example.com', 'An operator', 'operator')
       ON CONFLICT (email) DO UPDATE SET role = 'operator' RETURNING id`);
    await db.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1,$2, now() + interval '1 day')
       ON CONFLICT (token_hash) DO NOTHING`, [op.id, hashToken('shape-operator')]);
    jar.set('ccn_portal', 'shape-operator');
    expect(
      await getPortalSession(),
      'an operator session opened the public portals — the console is a different '
      + 'application and its role has a policy on every table',
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('the claims carry the role and the subject and nothing else', () => {
  it('names only the five keys the policy functions read', async () => {
    const { claimsFor } = await import('@/lib/session');
    const claims = claimsFor({
      userId: 'u', email: 'e@example.com', displayName: 'D', role: 'household',
      householdId: 'h', providerId: 'p', partnerId: 'r',
    });
    expect(Object.keys(claims).sort()).toEqual([
      'ccn_household_id', 'ccn_partner_id', 'ccn_provider_id', 'ccn_role', 'ccn_user_id',
    ]);
    // Not the email, not the display name. Neither is a policy input, and both are
    // personal detail that would then be sitting in a database GUC.
    expect(JSON.stringify(claims)).not.toContain('e@example.com');
    expect(JSON.stringify(claims)).not.toContain('"D"');
  });

  it('omits a subject the user does not have, rather than sending a null', async () => {
    const { claimsFor } = await import('@/lib/session');
    const claims = claimsFor({
      userId: 'u', email: 'e@example.com', displayName: 'D', role: 'provider',
      householdId: null, providerId: 'p', partnerId: null,
    });
    expect(Object.keys(claims).sort()).toEqual([
      'ccn_provider_id', 'ccn_role', 'ccn_user_id',
    ]);
  });

  /**
   * A user can accumulate memberships — an operator issues a provider invite to an
   * address that was already a household contact, and `household_users` is inserted
   * ON CONFLICT DO NOTHING, so the old row stays. The claims then carry both subjects.
   *
   * That is not a leak, and it is worth an assertion saying why: every policy in
   * migration 0003 is `current_role_name() = '…' AND <subject> = current_…()`, so the
   * role is a conjunct on each one and a provider-role session cannot use a household
   * claim it happens to be carrying. The role, not the claim, is what opens a table.
   */
  it('a session carrying two subjects still only reads through its own role', async () => {
    const { asPortalUser } = await import('@/lib/portalDb');
    const household = await one<{ id: string }>(
      `SELECT id FROM households ORDER BY created_at, id LIMIT 1`);
    const provider = await one<{ id: string }>(
      `SELECT id FROM providers ORDER BY created_at, id LIMIT 1`);

    const wearingBoth = {
      userId: (await one<{ id: string }>(
        `SELECT id FROM users WHERE email = 'shape-near@example.com'`)).id,
      email: 'shape-near@example.com',
      displayName: 'Near',
      role: 'provider' as const,
      householdId: household.id,
      providerId: provider.id,
      partnerId: null,
    };

    const rows = await asPortalUser(wearingBoth, (tx) => tx.query<{ id: string }>(
      `SELECT id FROM households WHERE id = $1`, [household.id]));
    expect(
      rows,
      'a provider-role session read a household row using a household claim it was '
      + 'carrying — the role is supposed to be a conjunct on every policy',
    ).toEqual([]);

    // The positive control, because the refusal above would also hold if the claim
    // were never reaching the policies at all. The same subject, under the role that
    // owns it, must come back.
    const asHousehold = await asPortalUser(
      { ...wearingBoth, role: 'household' },
      (tx) => tx.query<{ id: string }>(
        `SELECT id FROM households WHERE id = $1`, [household.id]));
    expect(
      asHousehold.map((r) => r.id),
      'the household claim is not reaching the policies at all, so the refusal above '
      + 'proves nothing',
    ).toEqual([household.id]);
  });
});

// ---------------------------------------------------------------------------

describe('the identity join resolves one subject, and the same one each time', () => {
  it('two households on one user do not make the answer change between requests', async () => {
    const { hashToken, getPortalSession } = await import('@/lib/session');
    const [a, b] = await db.query<{ id: string }>(
      `SELECT id FROM households ORDER BY created_at, id LIMIT 2`);
    expect(b, 'the seed has only one household, so this asserts nothing').toBeTruthy();

    const user = await one<{ id: string }>(
      `INSERT INTO users (email, display_name, role)
       VALUES ('shape-two-homes@example.com', 'Two homes', 'household')
       ON CONFLICT (email) DO UPDATE SET role = 'household' RETURNING id`);
    for (const h of [a!, b!]) {
      await db.query(
        `INSERT INTO household_users (user_id, household_id) VALUES ($1,$2)
         ON CONFLICT DO NOTHING`, [user.id, h.id]);
    }
    await db.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1,$2, now() + interval '1 day')
       ON CONFLICT (token_hash) DO NOTHING`, [user.id, hashToken('shape-two-homes')]);

    jar.clear();
    jar.set('ccn_portal', 'shape-two-homes');
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const s = await getPortalSession();
      seen.add(String(s?.householdId));
    }
    expect(
      [...seen],
      'the same cookie resolved to different households across requests. The query '
      + 'LIMITs one row out of a many-to-one join; without an ORDER BY which row is '
      + 'the planner’s choice, so a family with two cases can see one parent’s short '
      + 'list on one render and the other’s on the next.',
    ).toHaveLength(1);
    // It is one of theirs, not somebody else's.
    expect([a!.id, b!.id]).toContain([...seen][0]);
  });

  /*
   * THE STATIC ONE IS THE GUARD, and the sabotage run is how that is known. With the
   * ORDER BY deleted, the assertion above still passed — the embedded database happens
   * to walk that join in a stable order — while this one went red. A test that only
   * observed the behaviour would have been green against the bug on this database and
   * red against it on a real Postgres with a different plan, which is the worst of the
   * two outcomes.
   */
  it('the query orders its membership joins, which is what makes that true', () => {
    expect(
      SESSION_SRC,
      'lib/session.ts LIMITs a many-to-one join with no ORDER BY',
    ).toMatch(/ORDER BY[\s\S]{0,120}LIMIT 1/);
  });
});

// ---------------------------------------------------------------------------
// The neighbours.
// ---------------------------------------------------------------------------

/**
 * Every connection either application opens sets `request.jwt.claims` to
 * `{"ccn_role":"operator"}` as a startup parameter, so a plain `getDb()` query is an
 * OPERATOR-claimed query. `lib/portalDb.ts` is the only thing that narrows it — the
 * `SET LOCAL ROLE ccn_app` plus the per-session claims. A portal read that goes
 * straight to `getDb()` is therefore not constrained by row-level security at all, and
 * the application's own WHERE clause is the only thing deciding what a household sees.
 *
 * tests/portal.test.ts enforces the allow-list and matches on the literal string
 * `await getDb()`. This matches on a REFERENCE to the symbol instead, so
 * `getDb().then(…)`, `const h = getDb()` and an aliased import are covered by the same
 * rule rather than slipping past the spelling.
 */
describe('nothing in the portal reaches the database except through portalDb', () => {
  const ALLOWED = new Set([
    'lib/portalDb.ts', 'lib/session.ts', 'lib/availability.ts', 'lib/rateLimit.ts',
    'lib/rates.ts', 'lib/intake.ts', 'lib/notify.ts',
    'app/login/page.tsx', 'app/invite/[token]/route.ts',
  ]);

  function walkAll(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walkAll(full));
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  const files = [
    ...walkAll(path.join(ROOT, 'lib')),
    ...walkAll(path.join(ROOT, 'app')),
  ];

  /** Files that name `getDb` at all, however they spell the call. */
  function referencesGetDb(): string[] {
    return files
      .filter((f) => /\bgetDb\b/.test(code(f)))
      .map(rel)
      .sort();
  }

  it('finds the callers, so the rule is scanning something', () => {
    expect(referencesGetDb().length).toBeGreaterThan(5);
  });

  it('matches on the symbol rather than on one spelling of the call', () => {
    // `await getDb()` is the current spelling everywhere. These are the ones a future
    // edit could use instead, and the scan has to see all of them.
    for (const spelling of [
      'const h = getDb();', 'getDb().then((d) => d.query())',
      "import { getDb as db } from '@h-hallows/core/db'",
    ]) {
      expect(/\bgetDb\b/.test(spelling), `the scan misses ${spelling}`).toBe(true);
    }
  });

  it('only the documented infrastructure does, and none of it returns portal data', () => {
    const unexpected = referencesGetDb().filter((f) => !ALLOWED.has(f));
    expect(
      unexpected,
      `${unexpected.join(', ')} names getDb(). A plain connection carries operator `
      + 'claims as a startup parameter, so such a query is NOT constrained by the § 4 '
      + 'policies — only by whatever WHERE clause the file happens to have. Portal '
      + 'data goes through asPortalUser.',
    ).toEqual([]);
  });

  it('and the allow-list has no dead entries', () => {
    const actual = new Set(referencesGetDb());
    const dead = [...ALLOWED].filter((f) => !actual.has(f));
    expect(dead, `${dead.join(', ')} no longer names getDb()`).toEqual([]);
  });

  /**
   * `ccn_app` holds no DELETE privilege on any table, by design. `startSession` and
   * `endSession` delete `sessions` rows and work only because they run on a plain
   * connection as the owning role. Moving either under `asPortalUser` would break
   * sign-out — and silently, since the refusal surfaces as a redirect that leaves the
   * cookie's row in place.
   */
  it('the session writes stay off the reduced role, which cannot DELETE', () => {
    expect(SESSION_SRC).toMatch(/DELETE FROM sessions/);
    expect(
      SESSION_SRC,
      'lib/session.ts now routes a session write through asPortalUser. ccn_app has no '
      + 'DELETE privilege, so endSession would fail and a signed-out cookie would stay '
      + 'live for its full fourteen days. The grant belongs in a core migration.',
    ).not.toContain('asPortalUser');
  });
});
