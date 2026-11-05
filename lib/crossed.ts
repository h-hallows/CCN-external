/**
 * Routing and structured data for the crossed pages. Web build spec § 5 and § 8.
 */
import { CROSSED_PAGES, type CrossedPage } from '@/content/crossed';

export const CROSSED_BASE = '/care';

export function crossedPath(page: Pick<CrossedPage, 'service' | 'area'>): string {
  return `${CROSSED_BASE}/${page.service}/${page.area}`;
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
