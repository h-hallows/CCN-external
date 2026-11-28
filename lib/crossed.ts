/**
 * Routing and structured data for the crossed pages. Web build spec § 5 and § 8.
 */
import { CROSSED_PAGES, type CrossedPage } from '@/content/crossed';
import { AREAS, CARE_TYPES } from '@/lib/schemas/intake';

export const CROSSED_BASE = '/care';

export function crossedPath(page: Pick<CrossedPage, 'service' | 'area'>): string {
  return `${CROSSED_BASE}/${page.service}/${page.area}`;
}

/*
 * TWO SLUG SYSTEMS, AND THE ONE PLACE THEY ARE JOINED.
 *
 * The ten curated pages name their place `beverly-hills` and their service
 * `post-surgical-recovery`, because those are URL segments and a search engine reads
 * them. Every form, every enum and every row in the database says `beverly_hills` and
 * `post_surgical`, because those are identifiers. Both are right and neither is going
 * to change: the page slugs are published URLs, and the enums are what core stores.
 *
 * What was wrong was that nothing crossed between them, so the ten pages sat in the
 * application with nothing linking to any of them — a page that ranks for "post-surgical
 * nurse Beverly Hills" and cannot be reached from the site it is part of. The functions
 * below are the whole crossing, written once, with `AREAS` and `CARE_TYPES` as the
 * authority rather than a second list to keep in step.
 *
 * `rateKey` is doing the service half already and was not being used for it: every
 * curated page carries the care type it is about, as the same string the forms use, so
 * there is no service table to write. `tests/careIndex.test.ts` asserts that stays
 * true, and that the area halves round-trip, because this file is the only thing
 * standing between two spellings of the same place.
 */

export type Area = (typeof AREAS)[number];
export type CareType = (typeof CARE_TYPES)[number];

/** `santa_monica` to `santa-monica`. A derivation, not a table, and asserted as one. */
export function areaSlug(area: string): string {
  return area.replace(/_/g, '-');
}

/** `santa-monica` back to `santa_monica`. */
export function areaValue(slug: string): string {
  return slug.replace(/-/g, '_');
}

/** The enum member, or null for anything a visitor put in the query string by hand. */
export function asArea(value: unknown): Area | null {
  return typeof value === 'string' && (AREAS as readonly string[]).includes(value)
    ? value as Area
    : null;
}

export function asCareType(value: unknown): CareType | null {
  return typeof value === 'string' && (CARE_TYPES as readonly string[]).includes(value)
    ? value as CareType
    : null;
}

/** The curated page for a service and a place, when one of the ten is about that pair. */
export function curatedPage(care: CareType, area: Area): CrossedPage | null {
  const slug = areaSlug(area);
  return CROSSED_PAGES.find((p) => p.rateKey === care && p.area === slug) ?? null;
}

/** Every curated page about this place, whatever the service. */
export function pagesInArea(area: Area): CrossedPage[] {
  const slug = areaSlug(area);
  return CROSSED_PAGES.filter((p) => p.area === slug);
}

/** Every curated page about this service, wherever it is. */
export function pagesForCare(care: CareType): CrossedPage[] {
  return CROSSED_PAGES.filter((p) => p.rateKey === care);
}

/**
 * Where a person who has said what they need and where goes next.
 *
 * SEVEN SERVICES BY TEN PLACES IS SEVENTY PAIRS AND TEN PAGES EXIST. A picker that only
 * knew about the ten would send six visitors in seven to a 404, and a picker that
 * offered only the ten combinations would be a list of what we have written rather than
 * a question about what they need. So the unwritten sixty are not a gap to apologise
 * for: they go straight to the enquiry form with both answers already filled in, which
 * is the outcome the business wants from the ten as well. The curated page is the detour
 * for the pairs where there is something worth reading first.
 *
 * `not_sure` is a real answer on every form here and has no page by design, so it
 * resolves through the same branch as the other fifty-nine.
 */
export function careDestination(care: CareType, area: Area): string {
  const page = curatedPage(care, area);
  if (page) return crossedPath(page);
  return `/enquire?care=${care}&area=${area}`;
}

export function crossedRoutes(): { path: string }[] {
  return CROSSED_PAGES.map((page) => ({ path: crossedPath(page) }));
}

/**
 * FAQ structured data.
 *
 * `FAQPage` and `Question` only. § 8 forbids MedicalBusiness, HomeHealthCareService,
 * Physician and Hospital outright — claiming any of those describes a licensed
 * provider of care, which a registry is not, and HSC § 1726(c) exempts a registry from
 * that licensure precisely because it is not one. There is no `aggregateRating` either,
 * here or anywhere: a rating would be our opinion of a provider published as a fact.
 */
export function faqJsonLd(page: CrossedPage): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    name: page.title,
    mainEntity: page.questions.map((question) => ({
      '@type': 'Question',
      name: question.q,
      acceptedAnswer: { '@type': 'Answer', text: question.a },
    })),
  };
}
