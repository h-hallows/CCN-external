/**
 * What the three public intake routes are allowed to say back.
 *
 * `lib/intakeResponse.ts` carries one rule, stated at the top of the module: every
 * response is deliberately uninformative about anything already in the database,
 * because anyone can reach these endpoints. A form that answers "we already have a case
 * for this household" has disclosed that a household exists, that it is in care, and
 * that whoever asked was right to guess — to anybody who can type an address into a
 * public form.
 *
 * It had six exports and no test naming it. That is the combination worth fixing: a
 * module whose whole purpose is a negative property, where the property is invisible
 * when it holds and silent when it breaks. Nothing here would have failed if someone had
 * added `message: \`We already have a case for ${name}\`` to the accepted path.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  accepted, failed, limited, readBody, rejected, silentlyDropped,
} from '@/lib/intakeResponse';
import { z } from 'zod';

const ROOT = join(import.meta.dirname, '..');

function jsonRequest(body: unknown): Request {
  return new Request('https://example.test/api/inquiry', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function formRequest(pairs: [string, string][]): Request {
  const form = new FormData();
  for (const [k, v] of pairs) form.append(k, v);
  return new Request('https://example.test/api/inquiry', { method: 'POST', body: form });
}

describe('readBody', () => {
  it('reads JSON when the caller says it is JSON', async () => {
    expect(await readBody(jsonRequest({ name: 'A', area: 'Westwood' })))
      .toEqual({ name: 'A', area: 'Westwood' });
  });

  it('reads a form post, which is what a page without JavaScript sends', async () => {
    expect(await readBody(formRequest([['name', 'A'], ['area', 'Westwood']])))
      .toEqual({ name: 'A', area: 'Westwood' });
  });

  it('collects a repeated field into a list rather than keeping the last one', async () => {
    /*
     * Checkboxes. A form that asks which days care is needed sends `days` three times,
     * and taking the last would silently record one day out of three — a case that
     * matches nobody, on a record that looks complete.
     */
    const body = await readBody(formRequest([
      ['days', 'Mon'], ['days', 'Tue'], ['days', 'Wed'], ['name', 'A'],
    ]));
    expect(body.days).toEqual(['Mon', 'Tue', 'Wed']);
    expect(body.name).toBe('A');
  });

  it('drops anything that is not a string', async () => {
    // A file in a multipart body. Nothing public accepts uploads, and a File reaching
    // the validator would be a value it has no rule for.
    const form = new FormData();
    form.append('name', 'A');
    form.append('resume', new Blob(['x']), 'resume.pdf');
    const body = await readBody(
      new Request('https://example.test/api/apply', { method: 'POST', body: form }));
    expect(body).toEqual({ name: 'A' });
  });

  it('treats a request with no content-type as a form', async () => {
    const body = await readBody(formRequest([['name', 'A']]));
    expect(body).toEqual({ name: 'A' });
  });
});

describe('what the caller is told', () => {
  const UUID = '3f8a1c2e-9b44-4d7a-8f21-0c6e5d9a7b31';

  it('gives back a reference short enough not to be an id', async () => {
    const res = accepted('Thank you — we will call you back.', UUID);
    const body = await res.json() as { ok: boolean; message: string; reference: string };

    expect(res.status).toBe(202);
    expect(body.ok).toBe(true);
    expect(body.reference).toBe('3f8a1c2e');
    expect(body.reference).toHaveLength(8);
    // The whole point: enough for an operator to find the row when the caller quotes it,
    // not enough to address the row from outside.
    expect(JSON.stringify(body)).not.toContain(UUID);
  });

  it('says nothing in any response about what is already recorded', async () => {
    /*
     * The module's one rule, asserted over every response it can produce. None of these
     * is given a database row to describe, and the only caller-supplied value that
     * reaches a body is the message the ROUTE chose — which is why the structural test
     * below checks that the routes never compose one from a query result.
     */
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse({ email: 'not-an-email' });
    expect(parsed.success).toBe(false);

    const responses = [
      accepted('Thank you — we will call you back.', UUID),
      silentlyDropped(),
      rejected(parsed.error!),
      limited(),
      failed(),
    ];

    for (const res of responses) {
      const text = await res.clone().text();
      for (const leak of ['case', 'household', 'already', 'exists', 'duplicate', 'provider']) {
        expect(text.toLowerCase(), `a public response mentions "${leak}"`)
          .not.toContain(leak);
      }
      expect(res.headers.get('content-type')).toMatch(/application\/json/);
    }
  });

  it('tells a caller which field was wrong and nothing else', async () => {
    const parsed = z.object({
      email: z.string().email('That does not look like an email address.'),
      area: z.string().min(2),
    }).safeParse({ email: 'x', area: '' });

    const res = rejected(parsed.error!);
    const body = await res.json() as { ok: boolean; fieldErrors: Record<string, string[]> };

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(Object.keys(body.fieldErrors).sort()).toEqual(['area', 'email']);
    expect(body.fieldErrors.email).toContain('That does not look like an email address.');
    // No stack, no exception name, no path into the code.
    expect(JSON.stringify(body)).not.toMatch(/ZodError|at \w+ \(|\/lib\//);
  });

  it('answers a tripped honeypot with success, not with detection', async () => {
    /*
     * Telling a bot it was caught teaches whoever wrote it to stop filling the field,
     * which costs the protection. So a filled honeypot gets the status a real submission
     * gets, and no error of any kind.
     *
     * The bodies are NOT identical — a real acceptance carries `message` and
     * `reference`, and this does not. That difference is a tell for anyone comparing two
     * responses side by side, and it is left alone deliberately: closing it means
     * emitting a reference that corresponds to no record, and a fabricated reference is
     * a worse thing for this system to contain than a mild signal is. Asserted here so
     * the trade is recorded rather than discovered.
     */
    const dropped = silentlyDropped();
    const real = accepted('Thank you — we will call you back.', UUID);

    expect(dropped.status).toBe(real.status);
    const body = await dropped.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(Object.keys(body)).toEqual(['ok']);
  });

  it('asks a caller it cannot serve to telephone, in both failure modes', async () => {
    const rate = limited();
    const broken = failed();
    expect(rate.status).toBe(429);
    expect(broken.status).toBe(503);
    for (const res of [rate, broken]) {
      const body = await res.json() as { ok: boolean; message: string };
      expect(body.ok).toBe(false);
      // A public form that fails silently is a family that thinks it asked for help.
      expect(body.message.toLowerCase()).toContain('call us');
    }
  });
});

describe('the routes answer through this module and no other way', () => {
  const ROUTES = [
    'app/api/inquiry/route.ts',
    'app/api/apply/route.ts',
    'app/api/refer/route.ts',
  ];

  function code(path: string): string {
    return readFileSync(join(ROOT, path), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  }

  it('every public intake route imports the shared responses', () => {
    for (const route of ROUTES) {
      expect(code(route), `${route} does not use lib/intakeResponse`)
        .toMatch(/from '@\/lib\/intakeResponse'/);
    }
  });

  it('none of them builds a response of its own', () => {
    /*
     * The guard that matters. Three routes, each with a `catch`, each one line away from
     * `Response.json({ error: err.message })` — and a database error message carries the
     * constraint name, the table and sometimes the value that collided. The rule is that
     * a public endpoint's vocabulary is this module's and nothing else.
     */
    const offenders: string[] = [];
    for (const route of ROUTES) {
      const text = code(route);
      if (/Response\.json\(/.test(text)) offenders.push(`${route}: Response.json(`);
      if (/new Response\(/.test(text)) offenders.push(`${route}: new Response(`);
      if (/NextResponse/.test(text)) offenders.push(`${route}: NextResponse`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('never puts an error message into what the caller receives', () => {
    for (const route of ROUTES) {
      const text = code(route);
      // `rejected(parsed.error)` is the one legitimate case: a ZodError carries
      // field messages the module flattens, and nothing from the database.
      expect(text, `${route} returns an error message to the public`)
        .not.toMatch(/(accepted|limited|failed)\([^)\n]*\b(err|error|message)\b/);
    }
  });

  it('is the only module producing public intake responses', () => {
    /*
     * A fourth route added later should reuse these. This finds a response helper
     * growing somewhere else under app/api, which is how a second vocabulary starts.
     */
    const apiDir = join(ROOT, 'app/api');
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        if (entry.startsWith('.')) continue;
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(entry)) files.push(path);
      }
    };
    walk(apiDir);

    const offenders = files
      .filter((f) => !f.endsWith('health/route.ts'))
      .filter((f) => /Response\.json\(|new Response\(/.test(
        readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')))
      .map((f) => f.replace(ROOT, ''));

    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
