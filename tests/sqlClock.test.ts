/**
 * The public platform asks California what day it is, everywhere.
 *
 * The rule, and the four times this has gone wrong, are in
 * `@h-hallows/core/testing/sqlClock`. Two of the four were here: the household's
 * coverage window, which from late afternoon Pacific silently dropped TONIGHT's gaps —
 * including the overnight block, which is the one that matters at that hour — and the
 * provider's own schedule view beside it.
 *
 * This repository is the one where it matters most and is least likely to be noticed.
 * The console has one operator who would eventually say "that is not right". These
 * screens are read by households and by providers, who have no reason to think the
 * software is wrong rather than the roster.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { clockReport, clockViolations } from '@h-hallows/core/testing/sqlClock';

const ROOT = join(import.meta.dirname, '..');

function sources(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

function scanned(): { path: string; text: string }[] {
  return sources(join(ROOT, 'app'))
    .concat(sources(join(ROOT, 'lib')))
    .concat(sources(join(ROOT, 'components')))
    .concat(sources(join(ROOT, 'content')))
    .map((p) => ({ path: p.replace(ROOT, ''), text: readFileSync(p, 'utf8') }));
}

describe('no calendar date comes from the server clock', () => {
  it('has files to check, so a silent empty sweep cannot pass', () => {
    expect(scanned().length).toBeGreaterThan(40);
  });

  it('finds none in the public platform', () => {
    const found = clockViolations(scanned());
    expect(found, clockReport(found)).toEqual([]);
  });

  it('covers the two modules the defect was found in, by name', () => {
    for (const module of ['lib/schedule.ts', 'lib/pro.ts']) {
      const text = readFileSync(join(ROOT, module), 'utf8');
      expect(clockViolations([{ path: module, text }]), module).toEqual([]);
      expect(text, `${module} stopped deciding its dates in California`)
        .toMatch(/now\(\) AT TIME ZONE 'America\/Los_Angeles'/);
    }
  });
});
