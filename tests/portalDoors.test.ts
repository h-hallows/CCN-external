/**
 * The authorisation rule for the authenticated half, stated once over every surface
 * the filesystem contains rather than once per route.
 *
 * WHY A RULE AND NOT A LIST. Every existing portal test asserts a property of a named
 * module: portal.test.ts that `currentBenches` scopes to the household, providerPortal
 * .test.ts that `providerSelf` reads one row. All of them are true and none of them
 * says anything about a route added next week. A hardcoded list of routes is the same
 * mistake in miniature as the one this project is organised against: present, correct,
 * green, and silently not covering the thing somebody adds later.
 *
 * So the entry points are WALKED OFF DISK, and each one has to prove three things
 * before it reads or writes anything:
 *
 *   1. that there is a session at all;
 *   2. that the session's role matches the surface it is on;
 *   3. that the row being touched belongs to that session's subject.
 *
 * (1) and (2) are asserted here, by invoking the route. (3) is asserted here for the
 * three routes that take an id out of the URL, and at the module level in
 * portal.test.ts, request.test.ts, opportunities.test.ts and providerPortal.test.ts for
 * the rest.
 *
 * HOW A ROUTE IS INVOKED. A server component is an async function and a route handler
 * is an async function, so both can simply be called. `next/headers` is replaced with a
 * cookie jar this file controls; everything else — `redirect`, `notFound`, the database,
 * the policies — is the real thing. A refusal arrives as a thrown Next digest or as a
 * Response, and `outcome()` below flattens the two.
 *
 * WHAT MAKES THE ASSERTIONS NON-VACUOUS. A test that calls a route with no session and
 * checks it refuses would also pass against a route that refuses everybody, including
 * the person it is for. So every surface's own role is exercised too: each group layout
 * must ADMIT its own role, and each id-taking route must serve its own subject. Those
 * are the positive controls, and they are in the same file on purpose.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import * as ReactRuntime from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { DbHandle } from '@h-hallows/core/db';
import { seededDb } from '@h-hallows/core/testing';
import { ROOT, code, rel } from './importGraph';

/*
 * `tsconfig.json` sets `jsx: "preserve"`, so a `.tsx` file compiled for this suite
 * emits classic `React.createElement` calls and resolves `React` as a free variable.
 * Next supplies it; a bare vitest process does not. Nothing here renders — the element
 * tree is inspected as data — so the runtime only has to exist.
 */
(globalThis as { React?: unknown }).React = ReactRuntime;

// ---------------------------------------------------------------------------
// A cookie jar the test drives. Nothing else about Next is replaced.
// ---------------------------------------------------------------------------

const jar = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k) } : undefined),
    set: (k: string, v: string) => { jar.set(k, v); },
    delete: (k: string) => { jar.delete(k); },
  }),
  headers: async () => new Headers({ host: 'localhost:3003' }),
}));

// ---------------------------------------------------------------------------
// The surfaces, walked off disk.
// ---------------------------------------------------------------------------

/**
 * Every tree that is only reachable with a session.
 *
 * `app/login` is not here: it is the door, and it must serve somebody with no session.
 * `app/(marketing)` is not here: it is public and static.
 */
const PORTAL_TREES = [
  'app/(client)', 'app/(provider)', 'app/(partner)', 'app/portal-file', 'app/invite',
] as const;

/**
 * The one entry point that must NOT refuse an unauthenticated caller, with the reason.
 *
 * An invite link is how a session begins, so "refuses anyone without a session" is the
 * opposite of what it is for. It is covered instead by tests/inviteToken.test.ts, which
 * is where single use, replay and what a wrong token is told belong. The map is checked
 * for dead entries below, so it cannot quietly grow to cover a route somebody failed to
 * guard.
 */
const ENTRY_POINTS: Record<string, string> = {
  'app/invite/[token]/route.ts':
    'the invite link is how a session starts; see tests/inviteToken.test.ts',
};

interface Surface {
  /** Repo-relative path of the page or route handler. */
  file: string;
  /** The URL path it answers on, with its dynamic segments still in brackets. */
  route: string;
  /** Layouts above it, outermost first. The root layout is excluded — see below. */
  layouts: string[];
  /** 'household' | 'provider' | 'partner' | null when the tree is not role-scoped. */
  surfaceRole: PortalRoleName | null;
  kind: 'page' | 'route';
}

type PortalRoleName = 'household' | 'provider' | 'partner';

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (/^(page|route|layout)\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * The layouts Next will run above a file, outermost first.
 *
 * `app/layout.tsx` is deliberately excluded. It is the root, it authorises nothing, and
 * it imports the global stylesheet — importing it here would be asserting something
 * about the bundler rather than about authorisation.
 */
function layoutsAbove(file: string): string[] {
  const found: string[] = [];
  let dir = path.dirname(file);
  const appDir = path.join(ROOT, 'app');
  while (dir.startsWith(appDir)) {
    for (const name of ['layout.tsx', 'layout.ts']) {
      const candidate = path.join(dir, name);
      if (dir !== appDir && safeIsFile(candidate)) found.unshift(candidate);
    }
    dir = path.dirname(dir);
  }
  return found;
}

function safeIsFile(p: string): boolean {
  try { return statSync(p).isFile(); } catch { return false; }
}

/** 'app/(client)/portal/provider/[id]/page.tsx' -> '/portal/provider/[id]'. */
function routeOf(file: string): string {
  const withoutApp = rel(file).replace(/^app/, '').replace(/\/(page|route)\.tsx?$/, '');
  const stripped = withoutApp.replace(/\/\([^)]+\)/g, '');
  return stripped === '' ? '/' : stripped;
}

const TREE_ROLE: Record<string, PortalRoleName | null> = {
  'app/(client)': 'household',
  'app/(provider)': 'provider',
  'app/(partner)': 'partner',
  // Shared between a household and a provider by design: the policies on `documents`
  // decide, not the path. So there is no single role this surface belongs to.
  'app/portal-file': null,
  'app/invite': null,
};

function surfaces(): Surface[] {
  const out: Surface[] = [];
  for (const tree of PORTAL_TREES) {
    for (const file of walkFiles(path.join(ROOT, tree))) {
      if (/\/layout\.tsx?$/.test(file)) continue;
      out.push({
        file: rel(file),
        route: routeOf(file),
        layouts: layoutsAbove(file).map(rel),
        surfaceRole: TREE_ROLE[tree] ?? null,
        kind: /\/route\.tsx?$/.test(file) ? 'route' : 'page',
      });
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

const SURFACES = surfaces();
const GUARDED = SURFACES.filter((s) => !(s.file in ENTRY_POINTS));

// ---------------------------------------------------------------------------
// Invoking one, and flattening however it answered.
// ---------------------------------------------------------------------------

type Outcome =
  | { refused: true; how: string; to: string | null }
  | { refused: false; how: string; body: string };

const PLACEHOLDER: Record<string, string> = {
  id: '00000000-0000-4000-8000-000000000000',
  documentId: '00000000-0000-4000-8000-000000000000',
  referralId: '00000000-0000-4000-8000-000000000000',
  token: 'a-token-that-was-never-issued',
};

function paramsFor(route: string, overrides: Record<string, string> = {}) {
  const names = [...route.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]!);
  const out: Record<string, string> = {};
  for (const name of names) out[name] = overrides[name] ?? PLACEHOLDER[name] ?? 'x';
  return out;
}

function digestOf(err: unknown): string | null {
  const d = (err as { digest?: unknown } | null)?.digest;
  return typeof d === 'string' ? d : null;
}

/** NEXT_REDIRECT;replace;/login;307; -> '/login'. */
function redirectTarget(digest: string): string | null {
  const parts = digest.split(';');
  return parts[2] ?? null;
}

function classify(err: unknown): Outcome {
  const digest = digestOf(err);
  if (digest?.startsWith('NEXT_REDIRECT')) {
    return { refused: true, how: 'redirect', to: redirectTarget(digest) };
  }
  if (digest?.startsWith('NEXT_HTTP_ERROR_FALLBACK')) {
    return { refused: true, how: `http ${digest.split(';')[1]}`, to: null };
  }
  throw err;
}

const REFUSING_STATUS = new Set([401, 403, 404, 503]);

async function callOne(
  file: string,
  route: string,
  kind: 'page' | 'route',
  overrides: Record<string, string>,
): Promise<Outcome> {
  const mod = await import(/* @vite-ignore */ path.join(ROOT, file)) as Record<string, unknown>;
  const params = Promise.resolve(paramsFor(route, overrides));

  if (kind === 'route') {
    const handler = mod.GET as ((r: Request, ctx: unknown) => Promise<Response>) | undefined;
    if (!handler) throw new Error(`${file} exports no GET`);
    let res: Response;
    try {
      res = await handler(
        new Request(`http://localhost:3003${route}`, {
          headers: { 'x-forwarded-for': '198.51.100.7' },
        }),
        { params },
      );
    } catch (err) { return classify(err); }
    if (REFUSING_STATUS.has(res.status)) {
      return { refused: true, how: `status ${res.status}`, to: null };
    }
    return { refused: false, how: `status ${res.status}`, body: await res.text() };
  }

  const page = mod.default as ((p: unknown) => Promise<unknown>) | undefined;
  if (!page) throw new Error(`${file} exports no default`);
  try {
    const out = await page({ params, searchParams: Promise.resolve({}) });
    return { refused: false, how: 'rendered', body: stringify(out) };
  } catch (err) { return classify(err); }
}

/**
 * A rendered React tree, flattened to text so an assertion can look for a name in it.
 *
 * `$$typeof` is a Symbol and JSON.stringify drops it, which is fine: what matters is
 * that every string prop survives, and they do.
 */
function stringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, v) => {
    if (typeof v === 'object' && v !== null) {
      if (seen.has(v as object)) return '[circular]';
      seen.add(v as object);
    }
    if (typeof v === 'function') return '[fn]';
    return v;
  }) ?? '';
}

/**
 * A stand-in for the page, so the harness can tell whether a layout actually rendered
 * it.
 *
 * This is not a detail. `app/(client)/layout.tsx` answers an unreachable database by
 * returning `<Unavailable />` and DROPPING its children — the page beneath never runs,
 * exactly as in Next. A harness that called the page anyway would report a throw the
 * real request would never have reached.
 */
const CHILD_SENTINEL = '__CCN_PAGE_WOULD_RENDER_HERE__';

/** The whole chain Next runs: the layouts above it, outermost first, then the surface. */
async function callRoute(
  s: Surface,
  overrides: Record<string, string> = {},
): Promise<Outcome> {
  for (const layout of s.layouts) {
    const mod = await import(/* @vite-ignore */ path.join(ROOT, layout)) as Record<string, unknown>;
    const fn = mod.default as ((p: unknown) => Promise<unknown>) | undefined;
    if (!fn) continue;
    let rendered: unknown;
    try {
      rendered = await fn({ children: CHILD_SENTINEL, params: Promise.resolve({}) });
    } catch (err) {
      const outcome = classify(err);
      if (outcome.refused) return outcome;
      throw err;
    }
    if (!stringify(rendered).includes(CHILD_SENTINEL)) {
      return { refused: true, how: `${rel(path.join(ROOT, layout))} withheld the page`, to: null };
    }
  }
  return callOne(s.file, s.route, s.kind, overrides);
}

// ---------------------------------------------------------------------------
// Fixtures: one signed-in subject of each role, each with something to see.
// ---------------------------------------------------------------------------

let db: DbHandle;
const TOKENS: Record<PortalRoleName, string> = {
  household: 'doors-household-token',
  provider: 'doors-provider-token',
  partner: 'doors-partner-token',
};
let ourProviderId = '';
let ourReferralId = '';
let ourDocumentId = '';
let otherHouseholdDocumentId = '';

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const [row] = await db.query<T>(sql, params);
  if (!row) throw new Error(`fixture query returned no rows: ${sql}`);
  return row;
}

function signIn(role: PortalRoleName | null): void {
  jar.clear();
  if (role) jar.set('ccn_portal', TOKENS[role]);
}

beforeAll(async () => {
  db = await seededDb();
  const { hashToken } = await import('@/lib/session');
  const { createHash } = await import('node:crypto');

  /*
   * The household is chosen as one that already HAS a referral in the seed, rather
   * than by writing one here. A referral needs a disclosure and a disclosure needs a
   * timeline entry — I3, enforced by NOT NULL both ways — so manufacturing one would
   * mean manufacturing the statutory record the console exists to write, which is the
   * one thing a test in this repository should not teach anybody to do.
   */
  const seeded = await one<{
    referral_id: string; case_id: string; household_id: string; provider_id: string;
  }>(
    `SELECT r.id AS referral_id, c.id AS case_id, c.household_id, r.provider_id
       FROM referrals r
       JOIN cases c ON c.id = r.case_id
      WHERE c.status <> 'ended' AND c.deleted_at IS NULL
      ORDER BY r.referred_at, r.id
      LIMIT 1`);
  ourReferralId = seeded.referral_id;
  ourProviderId = seeded.provider_id;

  const otherHousehold = await one<{ id: string }>(
    `SELECT id FROM households WHERE id <> $1 ORDER BY created_at, id LIMIT 1`,
    [seeded.household_id]);
  // `provider_users` is UNIQUE on provider_id — one portal account per provider — so
  // the signed-in provider has to be one nothing else in the suite has claimed.
  const freeProvider = await one<{ id: string }>(
    `SELECT p.id FROM providers p
      WHERE NOT EXISTS (SELECT 1 FROM provider_users u WHERE u.provider_id = p.id)
      ORDER BY p.created_at, p.id LIMIT 1`);
  const partner = await one<{ id: string }>(
    `INSERT INTO referral_partners (name) VALUES ('Doors Test Partner') RETURNING id`);

  const mk = async (
    email: string, role: PortalRoleName, token: string,
  ): Promise<string> => {
    const user = await one<{ id: string }>(
      `INSERT INTO users (email, display_name, role) VALUES ($1, $2, $3::user_role)
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role RETURNING id`,
      [email, email.split('@')[0], role]);
    await db.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '1 day')
       ON CONFLICT (token_hash) DO NOTHING`, [user.id, hashToken(token)]);
    return user.id;
  };

  const householdUser = await mk('doors-household@example.com', 'household', TOKENS.household);
  await db.query(
    `INSERT INTO household_users (user_id, household_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`, [householdUser, seeded.household_id]);
  const providerUser = await mk('doors-provider@example.com', 'provider', TOKENS.provider);
  await db.query(
    `INSERT INTO provider_users (user_id, provider_id) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET provider_id = EXCLUDED.provider_id`,
    [providerUser, freeProvider.id]);
  const partnerUser = await mk('doors-partner@example.com', 'partner', TOKENS.partner);
  await db.query(
    `INSERT INTO partner_users (user_id, partner_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`, [partnerUser, partner.id]);

  // A bench for the household, so /portal/provider/[id] has something of its own.
  const shortlist = await one<{ id: string }>(
    `INSERT INTO published_shortlists (case_id, published_by, note)
     VALUES ($1, 'operator', 'Somebody we would send.') RETURNING id`, [seeded.case_id]);
  await db.query(
    `INSERT INTO published_shortlist_items (shortlist_id, provider_id, position)
     VALUES ($1, $2, 1) ON CONFLICT DO NOTHING`, [shortlist.id, ourProviderId]);

  // One document shared with this household, and one shared with another, so
  // /portal-file/[documentId] can be asked for both.
  const doc = async (householdId: string, name: string): Promise<string> => {
    const bytes = Buffer.from(`%PDF-1.4 ${name}`);
    return (await one<{ id: string }>(
      `INSERT INTO documents
         (kind, household_id, filename, content_type, byte_size, sha256_hex, bytes,
          uploaded_by, visible_to_subject)
       VALUES ('correspondence', $1, $2, 'application/pdf', $3, $4, $5, 'operator', true)
       RETURNING id`,
      [householdId, `${name}.pdf`, bytes.length,
        createHash('sha256').update(bytes).digest('hex'), bytes])).id;
  };
  ourDocumentId = await doc(seeded.household_id, 'doors-ours');
  otherHouseholdDocumentId = await doc(otherHousehold.id, 'doors-theirs');
});

// ---------------------------------------------------------------------------
// The enumeration itself has to be worth trusting before anything built on it is.
// ---------------------------------------------------------------------------

describe('the authenticated surfaces are found on disk, not listed here', () => {
  it('finds every portal tree, and more than a handful of surfaces', () => {
    expect(SURFACES.length).toBeGreaterThan(14);
    for (const tree of PORTAL_TREES) {
      expect(
        SURFACES.some((s) => s.file.startsWith(tree)),
        `nothing found under ${tree} — the walk is looking in the wrong place`,
      ).toBe(true);
    }
  });

  it('finds the four id-taking surfaces the brief singles out', () => {
    const routes = SURFACES.map((s) => s.route);
    for (const r of [
      '/portal/provider/[id]', '/portal/feedback/[referralId]',
      '/portal-file/[documentId]', '/invite/[token]',
    ]) {
      expect(routes, `${r} is not in the enumeration`).toContain(r);
    }
  });

  it('puts the group layout above every page in its tree', () => {
    for (const s of SURFACES) {
      if (!s.surfaceRole) continue;
      const group = s.file.slice(0, s.file.indexOf('/', 4));
      expect(
        s.layouts,
        `${s.file} has no group layout above it, so nothing checks its role`,
      ).toContain(`${group}/layout.tsx`);
    }
  });

  it('never walks up into the root layout, which authorises nothing', () => {
    for (const s of SURFACES) expect(s.layouts).not.toContain('app/layout.tsx');
  });

  it('exempts only entry points that exist, and names why', () => {
    const actual = new Set(SURFACES.map((s) => s.file));
    const dead = Object.keys(ENTRY_POINTS).filter((f) => !actual.has(f));
    expect(dead, `${dead.join(', ')} is exempted and no longer exists`).toEqual([]);
    expect(GUARDED.length).toBe(SURFACES.length - Object.keys(ENTRY_POINTS).length);
  });
});

// ---------------------------------------------------------------------------
// (1) There is a session at all.
// ---------------------------------------------------------------------------

describe('every authenticated surface refuses a caller with no session', () => {
  it.each(GUARDED.map((s) => [s.route, s] as const))(
    '%s', async (_route, s) => {
      signIn(null);
      const outcome = await callRoute(s);
      expect(
        outcome.refused,
        `${s.file} served an unauthenticated caller (${outcome.how})`,
      ).toBe(true);
      if (outcome.refused && outcome.how === 'redirect') {
        expect(outcome.to, `${s.file} redirected somewhere other than the door`)
          .toBe('/login');
      }
    });
});

// ---------------------------------------------------------------------------
// (2) The role matches the surface.
// ---------------------------------------------------------------------------

const ROLES: PortalRoleName[] = ['household', 'provider', 'partner'];

describe('every role-scoped surface refuses the other two roles', () => {
  const cases = GUARDED
    .filter((s) => s.surfaceRole !== null)
    .flatMap((s) => ROLES
      .filter((r) => r !== s.surfaceRole)
      .map((r) => [`${s.route} as ${r}`, s, r] as const));

  it('has a case for every surface and both wrong roles', () => {
    const scoped = GUARDED.filter((s) => s.surfaceRole !== null).length;
    expect(cases.length).toBe(scoped * 2);
    expect(scoped).toBeGreaterThan(12);
  });

  it.each(cases)('%s', async (_label, s, role) => {
    signIn(role);
    const outcome = await callRoute(s);
    expect(
      outcome.refused,
      `${s.file} served a ${role} session (${outcome.how})`,
    ).toBe(true);
  });
});

/**
 * The positive control for both of the above.
 *
 * Without this, a layout that redirected everybody — including the family it is for —
 * would pass every assertion in this file. The group layout is what refuses on behalf
 * of every page beneath it, so proving each layout ADMITS its own role is what makes
 * the two suites above mean something.
 */
describe('and admits the role it is for, so the refusals are not blanket', () => {
  const LAYOUTS: [PortalRoleName, string][] = [
    ['household', 'app/(client)/layout.tsx'],
    ['provider', 'app/(provider)/layout.tsx'],
    ['partner', 'app/(partner)/layout.tsx'],
  ];

  it.each(LAYOUTS)('the %s layout renders the page for a %s', async (role, file) => {
    signIn(role);
    const mod = await import(/* @vite-ignore */ path.join(ROOT, file)) as {
      default: (p: unknown) => Promise<unknown>;
    };
    const out = await mod.default({
      children: CHILD_SENTINEL, params: Promise.resolve({}),
    });
    expect(
      stringify(out),
      `${file} refused its own role, or withheld the page from it`,
    ).toContain(CHILD_SENTINEL);
  });

  it('the surface each layout guards is really the one being tested', () => {
    for (const [, file] of LAYOUTS) {
      const group = path.dirname(file);
      expect(GUARDED.some((s) => s.layouts.includes(file))).toBe(true);
      expect(GUARDED.some((s) => s.file.startsWith(group))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// (3) The row belongs to the session's subject — the routes that take an id.
// ---------------------------------------------------------------------------

describe('a route that takes an id out of the URL resolves it against the session', () => {
  const find = (route: string): Surface => {
    const s = SURFACES.find((x) => x.route === route);
    if (!s) throw new Error(`${route} is not in the enumeration`);
    return s;
  };

  it('serves this household its own provider profile', async () => {
    signIn('household');
    const outcome = await callRoute(find('/portal/provider/[id]'), { id: ourProviderId });
    expect(outcome.refused, 'the household cannot open a provider on its own bench').toBe(false);
  });

  it('refuses a provider id this household was never shown', async () => {
    const other = await one<{ id: string }>(
      `SELECT p.id FROM providers p
        WHERE NOT EXISTS (
          SELECT 1 FROM published_shortlist_items i WHERE i.provider_id = p.id)
        ORDER BY p.created_at, p.id LIMIT 1`);
    signIn('household');
    const outcome = await callRoute(find('/portal/provider/[id]'), { id: other.id });
    expect(outcome.refused, 'a provider off the bench was served').toBe(true);
  });

  it('serves this household its own referral feedback form', async () => {
    signIn('household');
    const outcome = await callRoute(
      find('/portal/feedback/[referralId]'), { referralId: ourReferralId });
    expect(outcome.refused, 'the household cannot reach its own feedback form').toBe(false);
  });

  it('refuses a referral id belonging to another case', async () => {
    const other = await one<{ id: string }>(
      `SELECT r.id FROM referrals r
        JOIN cases c ON c.id = r.case_id
       WHERE c.household_id <> (
         SELECT household_id FROM cases WHERE id = (
           SELECT case_id FROM referrals WHERE id = $1))
       ORDER BY r.referred_at, r.id LIMIT 1`, [ourReferralId]);
    signIn('household');
    const outcome = await callRoute(
      find('/portal/feedback/[referralId]'), { referralId: other.id });
    expect(outcome.refused, "another household's referral was served").toBe(true);
  });

  it('hands over a document shared with this household', async () => {
    signIn('household');
    const outcome = await callRoute(
      find('/portal-file/[documentId]'), { documentId: ourDocumentId });
    expect(outcome.refused, 'the household cannot download its own letter').toBe(false);
  });

  it("refuses another household's document, and says only that it is not found", async () => {
    signIn('household');
    const outcome = await callRoute(
      find('/portal-file/[documentId]'), { documentId: otherHouseholdDocumentId });
    expect(outcome.refused, "another household's document was handed over").toBe(true);
    if (outcome.refused) expect(outcome.how).toBe('status 404');
  });

  it('refuses it to a provider too, who has a session but no claim on it', async () => {
    signIn('provider');
    const outcome = await callRoute(
      find('/portal-file/[documentId]'), { documentId: ourDocumentId });
    expect(outcome.refused, "a household's document reached a provider").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// I12: the operator's private note about a provider must never cross.
// ---------------------------------------------------------------------------

describe('nothing a household is served carries the operator’s note on a provider', () => {
  it('the note exists to be leaked, so this is not testing an empty column', async () => {
    await db.query(
      `UPDATE providers SET notes = $2 WHERE id = $1`,
      [ourProviderId, 'OPERATOR-ONLY: declined by two families, do not put forward']);
    const [row] = await db.query<{ notes: string | null }>(
      `SELECT notes FROM providers WHERE id = $1`, [ourProviderId]);
    expect(row?.notes).toContain('OPERATOR-ONLY');
  });

  it('not in the bench, not in the profile, not in the request list', async () => {
    signIn('household');
    const { getPortalSession } = await import('@/lib/session');
    const session = await getPortalSession();
    expect(session?.role).toBe('household');

    const { currentBenches, benchProvider } = await import('@/lib/portal');
    const { householdRequests } = await import('@/lib/request');
    const { caseSchedules } = await import('@/lib/schedule');
    const served = stringify([
      await currentBenches(session!),
      await benchProvider(session!, ourProviderId),
      await householdRequests(session!),
      await caseSchedules(session!),
    ]);
    expect(served, 'a household read the operator’s private note').not.toContain('OPERATOR-ONLY');
  });

  it('and the rendered profile page does not either', async () => {
    signIn('household');
    const s = SURFACES.find((x) => x.route === '/portal/provider/[id]')!;
    const outcome = await callRoute(s, { id: ourProviderId });
    expect(outcome.refused).toBe(false);
    if (!outcome.refused) expect(outcome.body).not.toContain('OPERATOR-ONLY');
  });

  /**
   * The rule rather than the instance. `providers_household_select` is a ROW policy, so
   * a household that may see a provider at all may see every column of that row —
   * `notes` included. Nothing in the database stops a `SELECT *`, and nothing in
   * TypeScript does either. What stops it is that no query on this surface asks for
   * the column, and that is what this asserts.
   */
  it('no query reachable from the client portal names the column or selects every one', () => {
    const offenders: string[] = [];
    const files = [
      ...walkAll(path.join(ROOT, 'app/(client)')),
      ...walkAll(path.join(ROOT, 'lib')),
    ];
    for (const file of files) {
      const src = code(file);
      for (const m of src.matchAll(/SELECT[\s\S]{0,400}?FROM\s+providers\b/gi)) {
        const q = m[0];
        if (/\bselect\s+\*/i.test(q) || /\bnotes\b/i.test(q)) {
          offenders.push(`${rel(file)}: ${q.replace(/\s+/g, ' ').slice(0, 90)}`);
        }
      }
      if (/\bp\.\*|\bproviders\.\*/i.test(src)) offenders.push(`${rel(file)}: providers.*`);
    }
    expect(
      offenders,
      `${offenders.join('\n')}\nI12: the reason an ineligible provider is not shown `
      + 'lives in providers.notes, and a row policy does not withhold a column.',
    ).toEqual([]);
  });
});

function walkAll(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkAll(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Server actions: the layout does not run for one, so each must check for itself.
// ---------------------------------------------------------------------------

/**
 * A server action is a POST to the page's own URL that Next dispatches straight to the
 * function. No layout renders. So the role check in `app/(client)/layout.tsx` — the one
 * thing standing between a provider's session and the household surface — is simply not
 * in the path, and every action has to prove the session and the role itself.
 *
 * Walked off disk for the same reason as the routes above: the next action somebody
 * adds is the one that will not have the check.
 */
function actionModules(): string[] {
  const out: string[] = [];
  for (const tree of PORTAL_TREES) {
    for (const file of walkAll(path.join(ROOT, tree))) {
      if (/^\s*(['"])use server\1/m.test(readFileSync(file, 'utf8'))) out.push(rel(file));
    }
  }
  return out.sort();
}

const ACTION_MODULES = actionModules();

/** A refusal, however the action spells one. */
const SUCCESS_SHAPES = [
  '"ok":true', '"state":"saved"', '"state":"asked"', '"state":"already"',
  '"state":"answered"', '"state":"thanks"',
];

async function exportedActions(file: string): Promise<[string, (...a: unknown[]) => unknown][]> {
  const mod = await import(/* @vite-ignore */ path.join(ROOT, file)) as Record<string, unknown>;
  return Object.entries(mod)
    .filter((e): e is [string, (...a: unknown[]) => unknown] => typeof e[1] === 'function');
}

/** Plausible arguments, by arity. Every one of these must be refused, not validated. */
function argsFor(fn: (...a: unknown[]) => unknown): unknown[] {
  if (fn.length >= 2) {
    const form = new FormData();
    form.set('providerId', PLACEHOLDER.id!);
    form.set('referralId', PLACEHOLDER.referralId!);
    form.set('answer', 'yes');
    form.set('introductionRating', '5');
    form.set('rateHourly', '90');
    form.set('type', 'rn_license');
    form.set('restrictions', 'nothing');
    form.set('preferredName', 'Nobody');
    form.set('bio', '');
    form.set('phone', '');
    form.set('email', '');
    form.set('photoUrl', '');
    return [undefined, form];
  }
  if (fn.length === 1) return [PLACEHOLDER.id!];
  return [PLACEHOLDER.id!, 'some words'];
}

describe('a server action proves the session itself, because no layout runs for it', () => {
  it('finds the action modules on disk', () => {
    expect(ACTION_MODULES.length).toBeGreaterThan(3);
    for (const expected of [
      'app/(client)/portal/provider/[id]/actions.ts',
      'app/(client)/portal/feedback/[referralId]/actions.ts',
      'app/(client)/portal/profile/actions.ts',
      'app/(provider)/pro/actions.ts',
      'app/(provider)/pro/opportunityActions.ts',
    ]) {
      expect(ACTION_MODULES, `${expected} is not in the walk`).toContain(expected);
    }
  });

  it.each(ACTION_MODULES)('%s reads the session and compares the role', (file) => {
    const src = code(path.join(ROOT, file));
    expect(src, `${file} never reads the session`).toContain('getPortalSession');
    expect(
      /session[\s\S]{0,60}\.role\s*(===|!==)/.test(src) || /\.role\s*(===|!==)/.test(src),
      `${file} reads the session but never checks which role it is`,
    ).toBe(true);
  });

  for (const file of ACTION_MODULES) {
    for (const role of [null, ...ROLES] as const) {
      it(`${file} refuses ${role ?? 'nobody'}`, async () => {
        const actions = await exportedActions(file);
        expect(actions.length, `${file} exports no action`).toBeGreaterThan(0);
        for (const [name, fn] of actions) {
          // The surface this action belongs to is allowed to serve its own role.
          const tree = PORTAL_TREES.find((t) => file.startsWith(t))!;
          if (role !== null && role === TREE_ROLE[tree]) continue;
          signIn(role);
          let answer: string;
          try {
            answer = stringify(await fn(...argsFor(fn)));
          } catch (err) {
            const outcome = classify(err);
            expect(outcome.refused, `${file}#${name} threw`).toBe(true);
            continue;
          }
          for (const shape of SUCCESS_SHAPES) {
            expect(
              answer,
              `${file}#${name} answered ${role ?? 'an unauthenticated caller'} with ${shape}`,
            ).not.toContain(shape);
          }
        }
      });
    }
  }
});

// ---------------------------------------------------------------------------
// The state the deployment is actually in: no database.
// ---------------------------------------------------------------------------

/**
 * Today `ccn-external.vercel.app` has no database attached, so this is not an edge
 * case: it is the live behaviour of every authenticated surface. The rule is that each
 * one DEGRADES — says it is unavailable, or redirects to a page that does — rather than
 * throwing, because a throw is a 500 and a 500 on an invite link reads as a broken
 * invite rather than as a service that is not up yet.
 *
 * Enumerated off disk rather than listed. tests/marketing.test.ts has the same check
 * against a list of three files, which exempts the provider layout, the partner layout
 * and the download route — and one of those three was in fact unguarded when this was
 * written.
 */
describe('with no database, every authenticated surface degrades instead of throwing', () => {
  it('names a guard on every surface or a layout above it', () => {
    const unguarded: string[] = [];
    for (const s of SURFACES) {
      const chain = [s.file, ...s.layouts];
      // A CALL, not the import. Deleting the two lines that use it leaves the import
      // behind, and a scan for the name alone stays green on exactly that edit — which
      // is how this check was first written and what the sabotage run found.
      const guarded = chain.some(
        (f) => /databaseAvailable\s*\(/.test(code(path.join(ROOT, f))));
      if (!guarded) unguarded.push(s.file);
    }
    expect(
      unguarded,
      `${unguarded.join(', ')} reaches the database without asking whether there is `
      + 'one. With no DATABASE_URL — which is the state of the deployment today — that '
      + 'is a 500, not an Unavailable.',
    ).toEqual([]);
  });

  it('refuses rather than throws when the database is gone', async () => {
    vi.resetModules();
    const broken = new Error('DATABASE_URL is not set');
    vi.doMock('@h-hallows/core/db', () => ({
      getDb: async () => { throw broken; },
    }));
    try {
      for (const s of SURFACES) {
        signIn('household');
        let outcome: Outcome;
        try {
          outcome = await callRoute(s);
        } catch (err) {
          throw new Error(`${s.file} threw with no database: ${(err as Error).message}`);
        }
        // Either it said so, or it sent them to a page that does. Both are fine; a
        // throw is not.
        expect(outcome).toBeTruthy();
      }
    } finally {
      vi.doUnmock('@h-hallows/core/db');
      vi.resetModules();
    }
  });
});
