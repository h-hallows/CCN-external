/**
 * The crossed pages. Web build spec § 5, W10 — "ten pages that rank, not sixty that
 * do not."
 *
 * Every page is imported here, which is what makes the gate real: `assertComplete`
 * runs at module load, so a page that is short, templated or carries a rate figure
 * throws while this module is being evaluated and `next build` fails. There is no
 * route to render a thin page, because a thin page cannot be loaded.
 */
import { page as companionWestwood } from './companion-care--westwood';
import { page as hospiceBrentwood } from './hospice-support--brentwood';
import { page as newbornPalisades } from './overnight-newborn-care--pacific-palisades';
import { page as personalHolmby } from './personal-care--holmby-hills';
import { page as personalSantaMonica } from './personal-care--santa-monica';
import { page as postSurgicalBeverlyHills } from './post-surgical-recovery--beverly-hills';
import { page as postSurgicalSantaMonica } from './post-surgical-recovery--santa-monica';
import { page as respiteMalibu } from './respite-care--malibu';
import { page as nursingBelAir } from './skilled-nursing--bel-air';
import { page as nursingCenturyCity } from './skilled-nursing--century-city';
import type { CrossedPage } from './types';

export type { CrossedPage, CrossedQuestion } from './types';
export { MIN_COMMON_CASES, MIN_LOCAL_CONTEXT, MIN_QUESTIONS, MONEY } from './types';

export const CROSSED_PAGES: readonly CrossedPage[] = [
  postSurgicalBeverlyHills,
  postSurgicalSantaMonica,
  nursingCenturyCity,
  nursingBelAir,
  newbornPalisades,
  hospiceBrentwood,
  personalSantaMonica,
  personalHolmby,
  companionWestwood,
  respiteMalibu,
];

// Two pages at the same URL would mean one is unreachable and nobody would notice.
const seen = new Set<string>();
for (const page of CROSSED_PAGES) {
  const key = `${page.service}/${page.area}`;
  if (seen.has(key)) throw new Error(`two crossed pages claim /care/${key}`);
  seen.add(key);
}

export function crossedPage(service: string, area: string): CrossedPage | null {
  return CROSSED_PAGES.find((p) => p.service === service && p.area === area) ?? null;
}

/** Human labels derived from the slug, so a new page needs no registration here. */
export function areaName(slug: string): string {
  return slug.split('-').map((w) => (w === 'of' ? w : w[0]!.toUpperCase() + w.slice(1))).join(' ');
}
