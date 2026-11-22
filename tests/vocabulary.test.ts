/**
 * One vocabulary, and one contact.
 *
 * Core's `src/domain/care.ts` says in its own header why CARE_LABEL is shared: "a second
 * copy of CARE_LABEL is how 'Post-surgical' becomes 'Post surgical' on one page." It was
 * right, and by the time anybody counted there were eight copies of these lists across
 * the three repositories with three of the seven care labels already drifted — including
 * in the one form on this site that worked.
 *
 * The public wording is deliberately not core's: a console column is read by somebody
 * who already knows what it means, and a household reading a form has not met us. What
 * must not differ is the SET, which is what these assert.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CARE_LABEL as CORE_CARE_LABEL } from '@h-hallows/core/domain';
import {
  AREA_OPTIONS, CARE_OPTIONS, PUBLIC_CARE_LABEL, URGENCY_OPTIONS,
} from '@/lib/vocabulary';
import { CARE_TYPES, AREAS, URGENCIES } from '@/lib/schemas/intake';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => readFileSync(p, 'utf8');

function filesUnder(dir: string, match: RegExp): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (match.test(name)) out.push(full);
    }
  };
  walk(dir);
  return out;
}

describe('the public care list covers exactly what the database has', () => {
  it('has a public wording for every care type core knows about', () => {
    for (const key of Object.keys(CORE_CARE_LABEL)) {
      expect(
        PUBLIC_CARE_LABEL[key as keyof typeof PUBLIC_CARE_LABEL],
        `core has a care type '${key}' with no public wording, so it is missing from `
        + 'every form on this site',
      ).toBeTruthy();
    }
  });

  it('invents no care type the database could not store', () => {
    const known = new Set([...Object.keys(CORE_CARE_LABEL), 'not_sure']);
    for (const key of Object.keys(PUBLIC_CARE_LABEL)) {
      expect(known.has(key), `'${key}' is offered publicly and is not a care type`).toBe(true);
    }
  });

  it('matches the schema the intake routes validate against', () => {
    expect(CARE_OPTIONS.map((o) => o.value).sort()).toEqual([...CARE_TYPES].sort());
    expect(AREA_OPTIONS.map((o) => o.value).sort()).toEqual([...AREAS].sort());
    expect(URGENCY_OPTIONS.map((o) => o.value).sort()).toEqual([...URGENCIES].sort());
  });
});

describe('the lists live in one place', () => {
  /*
   * A component holding its own array of care types or areas is the next copy. The
   * partner referral form held three of them, which is where the drift was.
   */
  it('no component declares its own care or area list', () => {
    const components = filesUnder(join(ROOT, 'components'), /\.tsx$/);
    for (const file of components) {
      const src = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      const name = file.replace(ROOT, '');
      // Two or more of these slugs quoted in one file is a second copy of the list.
      const careSlugs = (src.match(/'(?:companion|personal_care|skilled_nursing|post_surgical|overnight_newborn|respite|hospice_support)'/g) ?? []).length;
      expect(careSlugs, `${name} declares its own care-type list`).toBeLessThan(2);
      const areaSlugs = (src.match(/'(?:century_city|beverly_hills|westwood|brentwood|bel_air|holmby_hills|santa_monica|pacific_palisades|malibu)'/g) ?? []).length;
      expect(areaSlugs, `${name} declares its own area list`).toBeLessThan(2);
    }
  });
});

describe('a stand-in is not a telephone number', () => {
  /*
   * THE TWO SENTINELS. `PHONE` falls back to `PENDING_PHONE` once a filed name is
   * claimed and to the prose "Telephone pending" before that, and every check compared
   * against the first. On the deployment as it has been running, `PHONE` held the prose
   * and `PHONE !== PENDING_PHONE` was true — so four screens served "call us on
   * Telephone pending — someone will pick up", and `/api/health` reported
   * `"contact": true` at the same time, which is what would have kept anybody from
   * going looking.
   */
  async function brandWith(env: Record<string, string | undefined>) {
    const saved: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(env)) {
      saved[k] = process.env[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    vi.resetModules();
    const brand = await import('@/lib/brand');
    return {
      brand,
      restore() {
        for (const [k, v] of Object.entries(saved)) {
          if (v === undefined) delete process.env[k];
          else process.env[k] = v;
        }
        vi.resetModules();
      },
    };
  }

  it('reports no contact before launch, when the phone is the prose stand-in', async () => {
    const { brand, restore } = await brandWith({
      NEXT_PUBLIC_PHONE: undefined,
      NEXT_PUBLIC_STREET: undefined,
      NEXT_PUBLIC_NAME_IS_FILED: undefined,
    });
    try {
      // Still printed in the footer, which is a different question and is why there
      // were two of them.
      expect(brand.contactLine()).toBe('Telephone pending');
      expect(
        brand.contactResolved(),
        'the site considered "Telephone pending" a telephone number',
      ).toBe(false);
    } finally {
      restore();
    }
  });

  it('reports a contact once a real number is configured', async () => {
    const { brand, restore } = await brandWith({
      NEXT_PUBLIC_PHONE: '(310) 555-0100',
      NEXT_PUBLIC_STREET: undefined,
    });
    try {
      expect(brand.contactResolved()).toBe(true);
      expect(brand.contactLine()).toBe('(310) 555-0100');
    } finally {
      restore();
    }
  });

  it('reports a contact from a street address alone', async () => {
    const { brand, restore } = await brandWith({
      NEXT_PUBLIC_PHONE: undefined,
      NEXT_PUBLIC_STREET: '1 Example Plaza, Los Angeles, CA 90067',
    });
    try {
      // § 1812.533(b)(2) is satisfied by either.
      expect(brand.contactResolved()).toBe(true);
    } finally {
      restore();
    }
  });

  it('never tells anybody to telephone a sentinel', () => {
    /*
     * The source rule behind the behaviour above: a call site that decides whether to
     * print a number by comparing PHONE to one sentinel will be wrong about the other.
     * `contactResolved()` is the only thing that should be making that decision.
     */
    const files = [
      ...filesUnder(join(ROOT, 'app'), /\.tsx$/),
      ...filesUnder(join(ROOT, 'components'), /\.tsx$/),
    ];
    for (const file of files) {
      const src = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(
        /PHONE\s*!==\s*PENDING_PHONE/.test(src),
        `${file.replace(ROOT, '')} compares PHONE to one sentinel; use contactResolved()`,
      ).toBe(false);
    }
  });
});
