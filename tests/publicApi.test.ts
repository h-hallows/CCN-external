/**
 * The three public intake routes and the health route, as rules over whatever is under
 * `app/api` rather than as three sets of assertions.
 *
 * tests/intake.test.ts and tests/intakeResponse.test.ts cover the schemas, the rate
 * limit and the shape of each helper. What they do not cover is the properties that
 * have to hold for EVERY route under app/api, including the fourth one somebody adds:
 *
 *   a filled honeypot is answered with the success a real submission gets, and never
 *   with anything that names the field;
 *
 *   nothing in any response distinguishes an address, a household or a patient the
 *   registry already knows from one it does not;
 *
 *   /api/health reports configuration by name and never by value.
 *
 * THE HONEYPOT ONE FOUND SOMETHING. `silentlyDropped()` was unreachable from every
 * route in the application: the field is `z.literal('').optional()`, so a filled
 * honeypot is refused by the schema and `parsed.data.honeypot` is only ever `''` or
 * `undefined`. The bot got a 400 listing `honeypot` among its `fieldErrors` — the exact
 * thing the function's own docstring says must not happen — and
 * tests/intake.test.ts accepted `[202, 400]`, so the suite was green either way.
 *
 * This test needs no valid body per route, which is what makes it a rule: a POST
 * carrying NOTHING BUT a filled honeypot is a bot by construction, and every route must
 * answer it the same way whatever else the schema would have said about the rest.
 */
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DbHandle } from '@h-hallows/core/db';
import { seededDb } from '@h-hallows/core/testing';
import { ROOT, code, rel } from './importGraph';

let db: DbHandle;

type Handler = (r: Request) => Promise<Response>;

interface ApiRoute {
  file: string;
  endpoint: string;
  post: Handler | null;
  get: (() => Promise<Response>) | null;
}

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (/^route\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const API_FILES = routeFiles(path.join(ROOT, 'app/api')).sort();
let ROUTES: ApiRoute[] = [];

/** A POST from a caller of our choosing, so the limiter does not bleed between tests. */
function post(body: unknown, ip: string): Request {
  return new Request('http://localhost:3003/api/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

async function count(table: string): Promise<number> {
  const [row] = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}`);
  return Number(row!.n);
}

let caller = 0;
const nextCaller = (): string => `192.0.2.${(caller = (caller + 1) % 250) + 1}`;

beforeAll(async () => {
  db = await seededDb();
  ROUTES = await Promise.all(API_FILES.map(async (file) => {
    const mod = await import(/* @vite-ignore */ file) as {
      POST?: Handler; GET?: () => Promise<Response>;
    };
    return {
      file: rel(file),
      endpoint: rel(file).replace(/^app/, '').replace(/\/route\.tsx?$/, ''),
      post: mod.POST ?? null,
      get: mod.GET ?? null,
    };
  }));
});

beforeEach(async () => { await db.query(`DELETE FROM rate_limit_hits`); });

// ---------------------------------------------------------------------------

describe('the public routes are walked off disk', () => {
  it('finds the three doors and the health probe', () => {
    const endpoints = API_FILES.map((f) =>
      rel(f).replace(/^app/, '').replace(/\/route\.tsx?$/, ''));
    for (const e of ['/api/inquiry', '/api/refer', '/api/apply', '/api/health']) {
      expect(endpoints, `${e} is not in the walk`).toContain(e);
    }
  });

  it('every one of them is unauthenticated, which is why the rest of this matters', () => {
    for (const file of API_FILES) {
      const src = code(file);
      // /api/refer reads a session to ATTRIBUTE a referral, and must not require one.
      if (src.includes('getPortalSession')) {
        expect(
          /role === 'partner' \? session : null|\?\.role === 'partner'/.test(src),
          `${rel(file)} reads a session — it must only use it to attribute, never to gate`,
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The honeypot.
// ---------------------------------------------------------------------------

describe('a filled honeypot is answered with success and told nothing', () => {
  it('has POST routes to assert this over', () => {
    expect(ROUTES.filter((r) => r.post).length).toBeGreaterThanOrEqual(3);
  });

  it.each(['inquiry', 'refer', 'apply'].map((n) => [`/api/${n}`] as const))(
    '%s answers 202 and exactly { ok: true }', async (endpoint) => {
      const route = ROUTES.find((r) => r.endpoint === endpoint && r.post);
      expect(route, `${endpoint} has no POST`).toBeTruthy();

      const before = {
        inquiries: await count('inquiries'),
        applications: await count('provider_applications'),
      };
      const res = await route!.post!(post({ honeypot: 'bot' }, nextCaller()));
      const text = await res.text();

      expect(
        res.status,
        `${endpoint} answered a tripped honeypot with ${res.status} and ${text}. `
        + 'A status that differs from a real submission tells whoever wrote the bot '
        + 'that the field is a trap, which costs the protection.',
      ).toBe(202);
      expect(JSON.parse(text)).toEqual({ ok: true });

      // And nothing was written, which is the other half of "silently dropped".
      expect(await count('inquiries')).toBe(before.inquiries);
      expect(await count('provider_applications')).toBe(before.applications);
    });

  it('never names the field, nor any other, in what the caller receives', async () => {
    for (const route of ROUTES.filter((r) => r.post)) {
      const res = await route.post!(post({ honeypot: 'bot', name: 'x' }, nextCaller()));
      const text = await res.text();
      for (const tell of ['honeypot', 'fieldErrors', 'literal', 'Invalid']) {
        expect(
          text,
          `${route.endpoint} said "${tell}" to a caller that tripped the honeypot`,
        ).not.toContain(tell);
      }
    }
  });

  it('an empty honeypot is still an ordinary submission', async () => {
    const inquiry = ROUTES.find((r) => r.endpoint === '/api/inquiry')!;
    const before = await count('inquiries');
    const res = await inquiry.post!(post({
      name: 'Dov Rosenthal', phone: '(626) 555-0000', relationship: 'child',
      careType: 'companion', area: 'bel_air', urgency: 'routine',
      paymentMethod: 'private', sourcePath: '/enquire', honeypot: '',
    }, nextCaller()));
    expect(res.status).toBe(202);
    expect(await count('inquiries')).toBe(before + 1);
  });

  it('a submission with no honeypot key at all is not mistaken for one', async () => {
    const inquiry = ROUTES.find((r) => r.endpoint === '/api/inquiry')!;
    const before = await count('inquiries');
    const res = await inquiry.post!(post({
      name: 'Dov Rosenthal', phone: '(626) 555-0000', relationship: 'child',
      careType: 'companion', area: 'bel_air', urgency: 'routine',
      paymentMethod: 'private', sourcePath: '/enquire',
    }, nextCaller()));
    expect(res.status).toBe(202);
    expect(await count('inquiries')).toBe(before + 1);
  });

  /**
   * The rule, stated over the source, so route number four cannot repeat it.
   *
   * The ORDER is the whole property: `readBody` has to be answered before the schema
   * sees it, because the schema's own refusal is what names the field.
   */
  it('every POST route checks the honeypot before the schema, not after', () => {
    for (const route of ROUTES.filter((r) => r.post)) {
      const src = code(path.join(ROOT, route.file));
      const check = src.indexOf('body.honeypot');
      const parse = src.indexOf('.safeParse(');
      expect(
        check,
        `${route.file} never looks at the raw honeypot. parsed.data.honeypot cannot `
        + "work: the field is z.literal('') so a filled one never reaches parsed.data.",
      ).toBeGreaterThan(-1);
      expect(
        check < parse,
        `${route.file} checks the honeypot after the schema, so the schema's own `
        + 'refusal reaches the caller first and names the field.',
      ).toBe(true);
      expect(src).toContain('silentlyDropped');
      expect(
        src,
        `${route.file} still reads parsed.data.honeypot, which is always falsy`,
      ).not.toContain('parsed.data.honeypot');
    }
  });
});

// ---------------------------------------------------------------------------
// No existence oracle. /api/refer is the sharp one: it takes a THIRD PARTY's details.
// ---------------------------------------------------------------------------

describe('no response distinguishes somebody we know from somebody we do not', () => {
  const REFERRAL = {
    partnerName: 'Dolores Hwang',
    partnerOrg: 'A hospital',
    partnerRole: 'discharge_planner',
    partnerPhone: '(626) 555-0100',
    partnerEmail: 'd.hwang@example.org',
    patientInitials: 'JM',
    careType: 'post_surgical',
    area: 'beverly_hills',
    urgency: 'routine',
    contactName: 'Grace Mwangi',
    contactPhone: '(626) 555-0199',
    consentNote: true,
  } as const;

  it('a referral naming a household we already have reads exactly like a new one', async () => {
    const refer = ROUTES.find((r) => r.endpoint === '/api/refer')!;
    // A real family, by the contact details the console holds for them. If anything in
    // the response changed, this form would be a way to ask "do the Kaplans use you?".
    const known = await db.query<{ name: string; phone: string }>(
      `SELECT dm_name AS name, dm_phone AS phone FROM households
        WHERE dm_phone IS NOT NULL ORDER BY created_at LIMIT 1`);
    const first = known[0];
    expect(first, 'the seed has no household with a contact, so this asserts nothing')
      .toBeTruthy();

    const a = await refer.post!(post(
      { ...REFERRAL, contactName: first!.name, contactPhone: first!.phone },
      nextCaller()));
    const b = await refer.post!(post(
      { ...REFERRAL, contactName: 'Nobody At All', contactPhone: '(310) 555-0001' },
      nextCaller()));

    expect(a.status).toBe(b.status);
    const [bodyA, bodyB] = [await a.json(), await b.json()] as Record<string, unknown>[];
    expect(Object.keys(bodyA!).sort()).toEqual(Object.keys(bodyB!).sort());
    expect(
      bodyA!.message,
      'the referral form says something different about a family we already have',
    ).toBe(bodyB!.message);
    // The reference differs, because it names a different new row. Its SHAPE must not.
    expect(String(bodyA!.reference)).toHaveLength(String(bodyB!.reference).length);
  });

  it('an enquiry from an address we hold reads exactly like one we do not', async () => {
    const inquiry = ROUTES.find((r) => r.endpoint === '/api/inquiry')!;
    const held = await db.query<{ email: string }>(
      `SELECT email FROM users WHERE email IS NOT NULL ORDER BY created_at LIMIT 1`);
    const base = {
      name: 'Dov Rosenthal', phone: '(626) 555-0000', relationship: 'child',
      careType: 'companion', area: 'bel_air', urgency: 'routine',
      paymentMethod: 'private', sourcePath: '/enquire',
    };
    const a = await inquiry.post!(post(
      { ...base, email: held[0]?.email ?? 'nobody@example.com' }, nextCaller()));
    const b = await inquiry.post!(post(
      { ...base, email: 'definitely-not-known@example.com' }, nextCaller()));

    expect(a.status).toBe(b.status);
    const [bodyA, bodyB] = [await a.json(), await b.json()] as Record<string, unknown>[];
    expect(bodyA!.message).toBe(bodyB!.message);
  });

  it('an application from an address we already have reads the same too', async () => {
    const apply = ROUTES.find((r) => r.endpoint === '/api/apply')!;
    const existing = await db.query<{ email: string }>(
      `SELECT email FROM providers WHERE email IS NOT NULL ORDER BY created_at LIMIT 1`);
    const base = {
      fullName: 'A Applicant', phone: '(310) 555-0100', type: 'CNA',
      areas: ['beverly_hills'], languages: ['English'], specialties: [],
    };
    const a = await apply.post!(post(
      { ...base, email: existing[0]?.email ?? 'nobody@example.com' }, nextCaller()));
    const b = await apply.post!(post(
      { ...base, email: 'nobody-here@example.com' }, nextCaller()));
    expect(a.status).toBe(b.status);
    expect((await a.json() as { message: string }).message)
      .toBe((await b.json() as { message: string }).message);
  });

  /**
   * And nothing in the source could start one.
   *
   * An oracle does not arrive as a message that says "we know them". It arrives as a
   * lookup somebody added to be helpful — pre-filling a form, skipping a duplicate,
   * telling a planner the family is already with us — and then branching on it.
   */
  it('no public route reads a household, case, provider or user before answering', () => {
    const offenders: string[] = [];
    for (const file of API_FILES) {
      const src = code(file);
      for (const m of src.matchAll(
        /FROM\s+(households|cases|providers|users|referrals|shortlist_requests)\b/gi)) {
        offenders.push(`${rel(file)}: SELECT ... FROM ${m[1]}`);
      }
    }
    expect(
      offenders,
      `${offenders.join('\n')}\nA public form that behaves differently for an address `
      + 'we hold is a way to find out which families use us.',
    ).toEqual([]);
  });

  it('and the patient is kept to initials, because the planner has not asked them yet', async () => {
    const refer = ROUTES.find((r) => r.endpoint === '/api/refer')!;
    const res = await refer.post!(post(
      { ...REFERRAL, patientInitials: 'Margaret Rosenthal-Vance' }, nextCaller()));
    expect(
      res.status,
      'the referral form accepted something longer than initials',
    ).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// What a refusal is allowed to echo.
// ---------------------------------------------------------------------------

describe('a refusal echoes nothing the caller did not already send', () => {
  it('names the fields that were wrong and no internal one', async () => {
    const inquiry = ROUTES.find((r) => r.endpoint === '/api/inquiry')!;
    const res = await inquiry.post!(post({ name: 'x' }, nextCaller()));
    expect(res.status).toBe(400);
    const text = await res.text();
    /*
     * Internal vocabulary only. `relationship` is a field on the form, so a scan for
     * "relation" flags the legitimate refusal — which is how a check like this gets
     * loosened until it catches nothing. These are strings that can only come from
     * the database or the schema's own innards.
     */
    for (const internal of [
      'household', 'disclosure', 'partner_id', 'referral_id', 'ccn_', 'pg_',
      'constraint', 'violates', 'relation "', 'column "', 'Unrecognized key',
    ]) {
      expect(text, `a public refusal mentioned "${internal}"`).not.toContain(internal);
    }
  });

  it('says nothing about the database when it cannot record', async () => {
    // `failed()` is the only 503 the public ever sees, and it carries one sentence.
    const { failed } = await import('@/lib/intakeResponse');
    const body = await failed().json() as { message: string };
    expect(body.message.toLowerCase()).toContain('call us');
    for (const leak of ['DATABASE_URL', 'ECONN', 'postgres', 'violates']) {
      expect(body.message).not.toContain(leak);
    }
  });
});

// ---------------------------------------------------------------------------
// /api/health.
// ---------------------------------------------------------------------------

describe('the health route reports configuration by name, never by value', () => {
  it('answers, and says whether it is ready', async () => {
    const health = ROUTES.find((r) => r.endpoint === '/api/health')!;
    expect(health.get, '/api/health has no GET').toBeTruthy();
    const res = await health.get!();
    expect([200, 503]).toContain(res.status);
    expect(res.headers.get('x-robots-tag')).toContain('noindex');
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('carries no configured value, no connection string and no address', async () => {
    const health = ROUTES.find((r) => r.endpoint === '/api/health')!;
    const text = await (await health.get!()).text();
    const configured = [
      process.env.DATABASE_URL, process.env.NEXT_PUBLIC_LEGAL_NAME,
      process.env.NEXT_PUBLIC_PHONE, process.env.RESEND_API_KEY,
      process.env.MAIL_FROM, process.env.OPERATOR_NOTIFY_EMAIL,
      process.env.OPERATOR_EMAILS,
    ].filter((v): v is string => Boolean(v && v.trim().length > 3));
    expect(configured.length, 'nothing is configured, so this asserts nothing')
      .toBeGreaterThan(0);
    for (const value of configured) {
      expect(text, `/api/health echoed a configured value: ${value}`)
        .not.toContain(value);
    }
    for (const shape of ['postgres://', 'postgresql://', '@', 're_']) {
      expect(text, `/api/health echoed something shaped like a secret: ${shape}`)
        .not.toContain(shape);
    }
  });

  it('counts nothing and names nobody', async () => {
    const health = ROUTES.find((r) => r.endpoint === '/api/health')!;
    const body = await (await health.get!()).json() as Record<string, unknown>;
    const text = JSON.stringify(body).toLowerCase();
    // A readiness probe that reports row counts is a public statement about how many
    // families the registry has.
    for (const leak of [
      'count', 'households', 'cases', 'inquiries', 'providers', 'sessions', 'users',
    ]) {
      expect(text, `/api/health discloses "${leak}"`).not.toContain(leak);
    }
    expect(Object.keys(body).sort()).toEqual([
      'brand', 'database', 'marketingPagesServeWithoutADatabase', 'ok',
      'signedInSurfacesNeedADatabase',
    ]);
  });

  it('takes no POST, so it is not a write path with no door on it', () => {
    const health = ROUTES.find((r) => r.endpoint === '/api/health')!;
    expect(health.post).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The limiter, and the one way its fail-open catch could matter.
// ---------------------------------------------------------------------------

/**
 * `rateLimit` fails OPEN, deliberately: a limiter that fails closed turns a database
 * blip into a lost discharge enquiry. The cost of that choice is that a refusal it
 * cannot distinguish from a blip also passes silently.
 *
 * `rate_limit_hits` has forced row-level security with an operator-only policy, and the
 * insert succeeds only because a plain `getDb()` connection carries operator claims as
 * a startup parameter. Called from inside an `asPortalUser` transaction it would be
 * running as `ccn_app` with a portal subject's claims, the insert would be refused, the
 * catch would swallow the refusal and the limiter would be off — with nothing in the
 * response, the status or the row count to show it.
 *
 * So the rule is that nothing calls it from in there.
 */
describe('the limiter is never called where its own insert would be refused', () => {
  it('no module calls rateLimit inside an asPortalUser callback', () => {
    const offenders: string[] = [];
    const files = [
      ...routeFiles(path.join(ROOT, 'app/api')),
      path.join(ROOT, 'app/login/page.tsx'),
      path.join(ROOT, 'app/invite/[token]/route.ts'),
      path.join(ROOT, 'lib/rateLimit.ts'),
    ];
    for (const file of files) {
      const src = code(file);
      if (!src.includes('rateLimit(')) continue;
      const portal = src.indexOf('asPortalUser');
      if (portal === -1) continue;
      // Crude on purpose: any file that does both is worth a human looking at.
      offenders.push(
        `${rel(file)} calls rateLimit and asPortalUser — check the limiter is not `
        + 'inside the transaction, where its insert is refused and the catch hides it');
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('and it still refuses a caller past the limit, so the catch is not always firing', async () => {
    const inquiry = ROUTES.find((r) => r.endpoint === '/api/inquiry')!;
    const ip = nextCaller();
    const body = {
      name: 'Dov Rosenthal', phone: '(626) 555-0000', relationship: 'child',
      careType: 'companion', area: 'bel_air', urgency: 'routine',
      paymentMethod: 'private', sourcePath: '/enquire',
    };
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await inquiry.post!(post(body, ip))).status);
    }
    expect(
      statuses[5],
      `the limiter let a sixth submission through: ${statuses.join(', ')}. If the `
      + 'insert into rate_limit_hits is being refused, the fail-open catch hides it.',
    ).toBe(429);
  });
});
