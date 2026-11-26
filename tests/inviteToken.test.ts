/**
 * `app/invite/[token]` — the only unauthenticated route in the application that writes,
 * and the only way a session begins.
 *
 * tests/login.test.ts asserts the ORDER of its two statements from the source and the
 * atomicity of the claim from the database. Neither of those runs the route. So nothing
 * until now had actually clicked an invite link twice, or clicked somebody else's, or
 * asked what the second click is told — and "single use" was a property of a SQL
 * statement rather than of a thing a person does with an email.
 *
 * The four questions here are the ones that matter for a link that arrives in an inbox
 * and then sits there:
 *
 *   it is single use IN FACT, not only in intent;
 *   a dead link says so without saying whether it was ever alive;
 *   it cannot be replayed, by the recipient or by anybody else;
 *   nothing about the subject reaches a caller holding the wrong token.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbHandle } from '@h-hallows/core/db';
import { seededDb } from '@h-hallows/core/testing';
import * as ReactRuntime from 'react';

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

const COOKIE = 'ccn_portal';

let db: DbHandle;
let hashToken: (t: string) => string;
/** The real handler. Typed from the module, so its NextRequest stays its own. */
let acceptInvite: typeof import('@/app/invite/[token]/route')['GET'];
let householdId = '';
let otherHouseholdId = '';

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const [row] = await db.query<T>(sql, params);
  if (!row) throw new Error(`fixture query returned no rows: ${sql}`);
  return row;
}

/** What the route answered: the path it redirected to, or a thrown error. */
async function click(token: string, ip = '203.0.113.10'): Promise<string> {
  try {
    await acceptInvite(
      // A plain Request is enough: the route reads one header and nothing else off it.
      new Request(`http://localhost:3003/invite/${token}`, {
        headers: { 'x-forwarded-for': ip },
      }) as never,
      { params: Promise.resolve({ token }) },
    );
  } catch (err) {
    const digest = (err as { digest?: unknown }).digest;
    if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) {
      return digest.split(';')[2] ?? '';
    }
    throw err;
  }
  throw new Error('the invite route returned without redirecting anywhere');
}

interface Invited { email: string; token: string; userId: string | null }

/**
 * An invite as the operator console issues one: hashed token, named subject, seven-day
 * life. `userId` is null until it is accepted, which is the point of the route.
 */
async function issue(
  email: string,
  opts: {
    token: string;
    householdId?: string;
    expiresIn?: string;
    revoked?: boolean;
    accepted?: boolean;
  },
): Promise<Invited> {
  await db.query(
    `INSERT INTO portal_invites
       (email, role, household_id, token_hash, issued_by, expires_at, revoked_at,
        accepted_at)
     VALUES ($1, 'household', $2, $3, 'operator',
             now() + ($4 || ' seconds')::interval,
             CASE WHEN $5 THEN now() ELSE NULL END,
             CASE WHEN $6 THEN now() ELSE NULL END)`,
    [
      email, opts.householdId ?? householdId, hashToken(opts.token),
      opts.expiresIn ?? String(7 * 86_400),
      opts.revoked ?? false, opts.accepted ?? false,
    ],
  );
  return { email, token: opts.token, userId: null };
}

async function sessionCount(email: string): Promise<number> {
  const [row] = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sessions s
       JOIN users u ON u.id = s.user_id WHERE u.email = $1`, [email]);
  return Number(row?.n ?? 0);
}

async function acceptedAt(token: string): Promise<string | null> {
  const [row] = await db.query<{ accepted_at: string | null }>(
    `SELECT accepted_at::text FROM portal_invites WHERE token_hash = $1`,
    [hashToken(token)]);
  return row?.accepted_at ?? null;
}

beforeAll(async () => {
  db = await seededDb();
  ({ hashToken } = await import('@/lib/session'));
  ({ GET: acceptInvite } = await import('@/app/invite/[token]/route'));

  householdId = (await one<{ id: string }>(
    `SELECT id FROM households ORDER BY created_at, id LIMIT 1`)).id;
  otherHouseholdId = (await one<{ id: string }>(
    `SELECT id FROM households WHERE id <> $1 ORDER BY created_at, id LIMIT 1`,
    [householdId])).id;
});

beforeEach(async () => {
  jar.clear();
  // The route is rate limited now, and these tests click a lot of links.
  await db.query(`DELETE FROM rate_limit_hits WHERE route = 'invite'`);
});

// ---------------------------------------------------------------------------
// The positive control, first, because everything below is a refusal.
// ---------------------------------------------------------------------------

describe('a link that was issued and never used lets its own recipient in', () => {
  it('signs them in, sets the cookie and sends them to their portal', async () => {
    const email = 'invite-happy@example.com';
    await issue(email, { token: 'invite-happy-token' });

    expect(await click('invite-happy-token')).toBe('/portal');
    expect(jar.get(COOKIE), 'no session cookie was set').toBeTruthy();
    expect(await sessionCount(email)).toBe(1);
    expect(await acceptedAt('invite-happy-token')).not.toBeNull();
  });

  it('attaches them to the household the invite named, and no other', async () => {
    const [row] = await db.query<{ household_id: string }>(
      `SELECT hu.household_id FROM household_users hu
         JOIN users u ON u.id = hu.user_id
        WHERE u.email = 'invite-happy@example.com'`);
    expect(row?.household_id).toBe(householdId);
  });
});

// ---------------------------------------------------------------------------
// Single use, in fact.
// ---------------------------------------------------------------------------

describe('single use is a fact about the link, not an intention', () => {
  it('a second click is refused, and does not issue a second session', async () => {
    const email = 'invite-once@example.com';
    await issue(email, { token: 'invite-once-token' });

    expect(await click('invite-once-token')).toBe('/portal');
    expect(await sessionCount(email)).toBe(1);
    const claimedAt = await acceptedAt('invite-once-token');

    jar.clear();
    expect(await click('invite-once-token')).toBe('/login?error=invite');
    expect(jar.get(COOKIE), 'a refused click still set a cookie').toBeUndefined();
    expect(await sessionCount(email)).toBe(1);
    // And the record of when it was accepted is the first click's, not the second's.
    expect(await acceptedAt('invite-once-token')).toBe(claimedAt);
  });

  it('cannot be replayed by somebody holding the link afterwards', async () => {
    // The recipient's own session is live in this browser. Clicking again — a forwarded
    // email, a bookmarked link, a browser restoring tabs — must not mint a second one.
    const email = 'invite-replay@example.com';
    await issue(email, { token: 'invite-replay-token' });
    expect(await click('invite-replay-token')).toBe('/portal');
    const first = jar.get(COOKIE);

    expect(await click('invite-replay-token')).toBe('/login?error=invite');
    expect(jar.get(COOKIE)).toBe(first);
    expect(await sessionCount(email)).toBe(1);
  });

  it('two clicks arriving together produce one session between them', async () => {
    const email = 'invite-race@example.com';
    await issue(email, { token: 'invite-race-token' });

    const answers = await Promise.all([
      click('invite-race-token').catch((e: Error) => e.message),
      click('invite-race-token').catch((e: Error) => e.message),
    ]);
    expect(answers.filter((a) => a === '/portal')).toHaveLength(1);
    expect(answers.filter((a) => a === '/login?error=invite')).toHaveLength(1);
    expect(await sessionCount(email)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// What a dead link is told, which must be the same thing in every case.
// ---------------------------------------------------------------------------

describe('a refusal says the link is dead and never whether it was alive', () => {
  /**
   * Four different situations, deliberately one answer.
   *
   * "Never issued" and "already used" being distinguishable is the interesting one: it
   * would let somebody holding a list of candidate tokens learn which had ever existed,
   * and a token that existed is a token that was emailed to a real household.
   */
  it('answers never-issued, used, expired and revoked identically', async () => {
    await issue('invite-used@example.com', {
      token: 'invite-used-token', accepted: true });
    await issue('invite-expired@example.com', {
      token: 'invite-expired-token', expiresIn: '-60' });
    await issue('invite-revoked@example.com', {
      token: 'invite-revoked-token', revoked: true });

    const answers = await Promise.all([
      click('a-token-that-was-never-issued'),
      click('invite-used-token'),
      click('invite-expired-token'),
      click('invite-revoked-token'),
    ]);
    expect(new Set(answers), `four different answers: ${answers.join(' / ')}`)
      .toEqual(new Set(['/login?error=invite']));
  });

  it('writes no session and no user for any of them', async () => {
    for (const email of [
      'invite-expired@example.com', 'invite-revoked@example.com',
    ]) {
      expect(await sessionCount(email), `${email} was let in`).toBe(0);
      const [row] = await db.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM users WHERE email = $1`, [email]);
      expect(Number(row?.n), `${email} was created by a refused link`).toBe(0);
    }
  });

  it('leaves an expired or revoked invite unaccepted, so the record stays honest', async () => {
    expect(await acceptedAt('invite-expired-token')).toBeNull();
    expect(await acceptedAt('invite-revoked-token')).toBeNull();
  });

  it('carries nothing about the subject in what the caller is given', async () => {
    const email = 'invite-leak@example.com';
    await issue(email, { token: 'invite-leak-token', householdId: otherHouseholdId });
    // A wrong token, and then the right one used up, so both refusal paths are covered.
    const wrong = await click('another-token-nobody-issued');
    await click('invite-leak-token');
    const used = await click('invite-leak-token');

    for (const answer of [wrong, used]) {
      for (const secret of [
        email, 'invite-leak', otherHouseholdId, householdId, 'household',
        'provider', 'partner',
      ]) {
        expect(answer, `the refusal leaks "${secret}"`).not.toContain(secret);
      }
    }
  });

  it('and the destination it names is a page that explains itself', async () => {
    const { default: Login } = await import('@/app/login/page') as {
      default: (p: unknown) => Promise<unknown>;
    };
    jar.clear();
    const rendered = JSON.stringify(
      await Login({ searchParams: Promise.resolve({ error: 'invite' }) }),
      (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(rendered).toContain('no longer valid');
  });
});

// ---------------------------------------------------------------------------
// A link clicked in somebody else's browser.
// ---------------------------------------------------------------------------

describe('a link opened where another person is signed in', () => {
  it('is refused, keeps the first session, and LEAVES THE LINK USABLE', async () => {
    // The whole point of the statement order in the route. The security property —
    // no takeover — held even when the order was wrong; the availability one did not,
    // and the operator's screen said "accepted" while the recipient had nothing.
    const sitting = 'invite-sitting@example.com';
    const arriving = 'invite-arriving@example.com';
    await issue(sitting, { token: 'invite-sitting-token' });
    await issue(arriving, { token: 'invite-arriving-token' });

    expect(await click('invite-sitting-token')).toBe('/portal');
    const theirCookie = jar.get(COOKIE);

    expect(await click('invite-arriving-token'))
      .toBe('/login?error=signed-in-as-someone-else');
    expect(jar.get(COOKIE), 'the session was swapped').toBe(theirCookie);
    expect(
      await acceptedAt('invite-arriving-token'),
      'the refusal burned the link it refused',
    ).toBeNull();
    expect(await sessionCount(arriving)).toBe(0);

    // And the real recipient can still use it, from their own browser.
    jar.clear();
    expect(await click('invite-arriving-token')).toBe('/portal');
    expect(await sessionCount(arriving)).toBe(1);
  });

  it('re-opening your OWN link while signed in is not treated as a swap', async () => {
    const email = 'invite-mine@example.com';
    await issue(email, { token: 'invite-mine-a' });
    await issue(email, { token: 'invite-mine-b' });

    expect(await click('invite-mine-a')).toBe('/portal');
    // Same person, second link — an operator reissuing one, or two emails in the inbox.
    expect(await click('invite-mine-b')).toBe('/portal');
  });

  /**
   * The dead end this found.
   *
   * `error=signed-in-as-someone-else` is only ever produced for a visitor who HAS a
   * session — that is what the refusal is about — and the sign-in page redirected every
   * such visitor to their own portal before rendering anything. So the one message the
   * refusal exists to deliver could not be reached by the only person who can arrive at
   * it, and the link appeared to do nothing at all.
   */
  it('and the page it sends them to actually says so, rather than bouncing them', async () => {
    const { default: Login } = await import('@/app/login/page') as {
      default: (p: unknown) => Promise<unknown>;
    };
    await issue('invite-bounce@example.com', { token: 'invite-bounce-token' });
    jar.clear();
    await click('invite-bounce-token');
    expect(jar.get(COOKIE), 'the fixture did not actually sign anybody in').toBeTruthy();

    let rendered = '';
    try {
      rendered = JSON.stringify(
        await Login({ searchParams: Promise.resolve({ error: 'signed-in-as-someone-else' }) }),
        (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    } catch (err) {
      const digest = (err as { digest?: unknown }).digest;
      throw new Error(
        'the sign-in page redirected a signed-in visitor away from the one message '
        + `the invite refusal exists to show them: ${String(digest)}`);
    }
    expect(rendered).toContain('for someone else');
    expect(rendered, 'no way out of it').toContain('Sign out');
  });
});

// ---------------------------------------------------------------------------
// Revocation has to outlast a link issued before it.
// ---------------------------------------------------------------------------

describe('a disabled account is not re-opened by a link still sitting in the inbox', () => {
  it('refuses, and does not clear disabled_at', async () => {
    const email = 'invite-disabled@example.com';
    await issue(email, { token: 'invite-disabled-token' });
    expect(await click('invite-disabled-token')).toBe('/portal');

    await db.query(`UPDATE users SET disabled_at = now() WHERE email = $1`, [email]);
    await db.query(`DELETE FROM sessions WHERE user_id = (
      SELECT id FROM users WHERE email = $1)`, [email]);
    await issue(email, { token: 'invite-disabled-again' });

    jar.clear();
    expect(await click('invite-disabled-again')).toBe('/login?error=invite');
    expect(await sessionCount(email)).toBe(0);
    const [row] = await db.query<{ disabled_at: string | null }>(
      `SELECT disabled_at::text FROM users WHERE email = $1`, [email]);
    expect(row?.disabled_at, 'a link re-enabled a withdrawn account').not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Rate limiting.
// ---------------------------------------------------------------------------

/**
 * Not because a 32-byte token is guessable. Because this is the one unauthenticated
 * route in the application that WRITES — `users`, three membership tables, `sessions`
 * — and it was the only door in the building with no counter on it while `/login`,
 * `/api/inquiry`, `/api/refer` and `/api/apply` all had one.
 */
describe('the invite route counts attempts, like every other door', () => {
  it('refuses a caller past the limit', async () => {
    const ip = '198.51.100.44';
    const answers: string[] = [];
    for (let i = 0; i < 21; i++) {
      answers.push(await click(`never-issued-${i}`, ip));
    }
    expect(answers.slice(0, 20).every((a) => a === '/login?error=invite')).toBe(true);
    expect(answers[20]).toBe('/login?error=too-many');
  });

  it('counts each caller separately, so one abuser cannot lock a hospital out', async () => {
    expect(await click('never-issued-x', '198.51.100.45')).toBe('/login?error=invite');
  });

  it('does not consume the link of a caller it turned away', async () => {
    const ip = '198.51.100.46';
    await issue('invite-limited@example.com', { token: 'invite-limited-token' });
    for (let i = 0; i < 20; i++) await click(`filler-${i}`, ip);

    expect(await click('invite-limited-token', ip)).toBe('/login?error=too-many');
    expect(
      await acceptedAt('invite-limited-token'),
      'a rate-limited click burned a perfectly good link',
    ).toBeNull();

    // And it still works from somewhere else, which is what the copy promises.
    jar.clear();
    expect(await click('invite-limited-token', '198.51.100.47')).toBe('/portal');
  });

  it('stores the caller as a hash, never as an address', async () => {
    await db.query(`DELETE FROM rate_limit_hits WHERE route = 'invite'`);
    await click('never-issued-y', '198.51.100.48');
    const rows = await db.query<{ key_hash: string }>(
      `SELECT key_hash FROM rate_limit_hits WHERE route = 'invite'`);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.key_hash).not.toContain('198.51.100.48');
      expect(r.key_hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('and the page it sends a limited caller to says the link still works', async () => {
    const { default: Login } = await import('@/app/login/page') as {
      default: (p: unknown) => Promise<unknown>;
    };
    jar.clear();
    const rendered = JSON.stringify(
      await Login({ searchParams: Promise.resolve({ error: 'too-many' }) }),
      (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(rendered).toContain('still works');
  });
});
