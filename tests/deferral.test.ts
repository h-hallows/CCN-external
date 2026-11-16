/**
 * The nine-factor deferral, from the side that actually touches the table.
 *
 * `CCN-Registry/DEFERRED.md` blocks the scheduling and coverage surface until the § 0.5
 * item 2 audit is done with counsel. It used to say that no query, server action or
 * component touched `coverage_gaps`. This repository had been reading it and rendering
 * the result on `/portal/schedule` for weeks, and nobody noticed — because nothing
 * writes the table, so the section renders nothing, and an empty section looks exactly
 * like an absent one.
 *
 * The document is corrected. These assertions are the part that cannot go out of date.
 *
 * WHAT IS ACTUALLY GATED. Not the display. The deferral anticipates a "record-only
 * coverage view" as the permitted end state, and showing a household the dates its own
 * care is uncovered is that view. What is gated is the registry COORDINATING cover —
 * creating a gap, resolving one, naming who will fill it. That is the activity
 * § 1812.5095(b)(5) and § 687.2(e) constrain, and writing it down is what turns it from
 * a phone call into evidence. So: one named reader, and no writers anywhere.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

function sources(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

function appSources(): string[] {
  return sources(join(ROOT, 'app'))
    .concat(sources(join(ROOT, 'lib')))
    .concat(sources(join(ROOT, 'components')))
    .concat(sources(join(ROOT, 'content')));
}

function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('coverage gaps are displayed, never coordinated', () => {
  it('writes to coverage_gaps from nowhere', () => {
    const offenders = appSources()
      .filter((f) => /(INSERT INTO|UPDATE|DELETE FROM)\s+coverage_gaps\b/i.test(code(f)))
      .map((f) => f.replace(ROOT, ''));

    expect(
      offenders,
      'Creating, resolving or assigning a coverage gap is the coordination the § 0.5 '
      + 'item 2 audit blocks. The display is permitted; the record of arranging cover '
      + 'is not. See CCN-Registry/DEFERRED.md.',
    ).toEqual([]);
  });

  it('reads it from exactly one module, named here', () => {
    /*
     * Not "at most one" — exactly this one. A second reader is how a display becomes a
     * workflow: a component that fetches gaps for itself is a component that will
     * shortly offer to do something about them.
     */
    const readers = appSources()
      .filter((f) => /\bcoverage_gaps\b/i.test(code(f)))
      .map((f) => f.replace(ROOT + '/', ''));
    expect(readers).toEqual(['lib/schedule.ts']);
  });

  it('offers no action that resolves or assigns one', () => {
    /*
     * The portal's writes are the household's own: its profile, a shortlist request,
     * feedback. None of them is about cover. This looks for a server action whose body
     * mentions the table at all — `'use server'` plus `coverage_gaps` in one file is
     * the shape of a fill-this-gap button, whichever verb it ends up using.
     */
    const offenders = appSources()
      .filter((f) => {
        const text = code(f);
        return /['"]use server['"]/.test(text) && /\bcoverage_gaps\b|\bgaps\b/.test(text);
      })
      .map((f) => f.replace(ROOT, ''));
    expect(offenders).toEqual([]);
  });

  it('shows a household only its own, which the database enforces regardless', () => {
    /*
     * `lib/schedule.ts` runs inside `asPortalUser`, so row-level security answers this
     * whatever the query says. Asserted at the source as well because the query has no
     * household predicate of its own — it is correct only because of the role it runs
     * under, and that is exactly the kind of correctness that survives a refactor by
     * luck rather than by design. tests/clientPortal.test.ts drives the behaviour.
     */
    const schedule = readFileSync(join(ROOT, 'lib/schedule.ts'), 'utf8');
    expect(schedule).toMatch(/asPortalUser/);
    expect(code(join(ROOT, 'lib/schedule.ts'))).not.toMatch(/SET LOCAL ROLE\s+(?!ccn_app)/);
  });
});
