/**
 * A sign-in link must not reach the server log, and a notification must not carry a
 * family into an inbox.
 *
 * `/login` used to print the invite link to the server console with a comment saying a
 * mail provider goes here. In a deployment that means anyone who can read function logs
 * can sign in as any family by copying a line out of them, and the page behaves
 * perfectly while it happens — there is no runtime moment at which the mistake is
 * observable. So this reads the source.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = ['app', 'lib', 'components'];
const SECRET = /\b(token|invite|magic|hash)\b/i;

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

function consoleCalls(source: string): { at: number; args: string }[] {
  const found: { at: number; args: string }[] = [];
  const call = /console\.(log|info|warn|error|debug)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = call.exec(source)) !== null) {
    let depth = 1;
    let i = call.lastIndex;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      i += 1;
    }
    found.push({
      at: source.slice(0, match.index).split('\n').length,
      args: source.slice(call.lastIndex, i - 1),
    });
  }
  return found;
}

describe('nothing logs a credential', () => {
  const files = ROOTS.flatMap((r) => sources(r));

  it('finds the source to read', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it('no console call anywhere mentions a token, invite or hash', () => {
    const offences: string[] = [];
    for (const file of files) {
      for (const { at, args } of consoleCalls(readFileSync(file, 'utf8'))) {
        if (SECRET.test(args)) offences.push(`${file}:${at} — console(${args.trim()})`);
      }
    }
    expect(offences).toEqual([]);
  });

  it('the sign-in page sends, and decides on configuration before the lookup', () => {
    const page = readFileSync('app/login/page.tsx', 'utf8');
    expect(consoleCalls(page)).toEqual([]);
    expect(page).toContain('sendMail');

    // Order is the property. A mailer either exists or does not, the same for every
    // address; deciding after the lookup would tell a visitor whether one is known.
    const gate = page.indexOf('mailConfigured()');
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(page.indexOf('SELECT id FROM users'));
  });
});

describe('an operator notification carries no family into an inbox', () => {
  const notify = readFileSync('lib/notify.ts', 'utf8');

  it('sends the subject and body, and never the payload', () => {
    expect(notify).toContain('sendMail');
    const send = notify.slice(notify.indexOf('await sendMail('));
    const call = send.slice(0, send.indexOf('});') + 3);
    // `payload` is everything the console needs, and some of it identifies a family.
    expect(call).not.toContain('payload');
    expect(call).toContain('n.subject');
    expect(call).toContain('n.body');
  });

  it('writes the row before it tries to send, and not the other way round', () => {
    expect(notify.indexOf('INSERT INTO operator_notifications'))
      .toBeLessThan(notify.indexOf('nudgeOperator(n)'));
  });

  it('needs an address set deliberately — it never guesses one', () => {
    expect(notify).toContain('OPERATOR_NOTIFY_EMAIL');
    expect(notify).toMatch(/if \(!to \|\| !mailConfigured\(\)\) return;/);
  });
});
