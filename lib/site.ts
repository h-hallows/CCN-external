/** Site-level facts the metadata routes share. */
import { contactLine, PHONE } from '@/lib/brand';

/**
 * The canonical origin. Falls back to a localhost default so a build without the
 * variable still produces valid absolute URLs rather than `undefined/sitemap.xml`.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return 'http://localhost:3003';
}

type ChangeFrequency = 'yearly' | 'monthly' | 'weekly' | 'daily';

export const MARKETING_ROUTES: {
  path: string; priority: number; changeFrequency: ChangeFrequency;
}[] = [
  { path: '/', priority: 1.0, changeFrequency: 'monthly' },
  { path: '/how-it-works', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/pricing', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/vetting', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/for-providers', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/for-partners', priority: 0.7, changeFrequency: 'monthly' },
  /*
   * The three doors, above the pages that argue for them. `/enquire` is the one the
   * business runs on, so it sits level with the homepage — and `tests/doors.test.ts`
   * asserts every route under app/(marketing) appears in this list and that nothing
   * here is missing a page, which is what will catch the next page that is built and
   * then never listed.
   */
  { path: '/enquire', priority: 1.0, changeFrequency: 'monthly' },
  { path: '/refer', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/apply', priority: 0.7, changeFrequency: 'monthly' },
  /*
   * The privacy notice, which the three doors above it are the reason for. Low priority
   * and yearly because it is not what anybody arrives for, and listed because a notice a
   * search engine cannot find is one a person looking for it cannot find either.
   */
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
];

/**
 * A telephone number somebody can actually dial, as a `tel:` URL, or null.
 *
 * THE FAILURE THIS IS SHAPED AROUND, which lib/brand.ts records in its own words: there
 * are two stand-ins for the telephone number and every check was comparing against one
 * of them, so the site believed it had a number and four screens served "call us on
 * Telephone pending". `contactResolved()` is not the question either — it is satisfied
 * by a street address, and a street address is not something a dead end can offer as a
 * link.
 *
 * So this asks the shape of the line rather than naming the stand-ins: a number you can
 * dial contains only the characters on a keypad, and every stand-in this repository has
 * — `PENDING_PHONE`, the prose `Telephone pending`, and a street address — contains
 * letters. A third stand-in added later is caught by the same line, which is exactly
 * what naming them one at a time failed to do.
 */
export function telHref(): string | null {
  const line = contactLine();
  // `contactLine()` returns the street address when there is no telephone number, and
  // the address is not callable however many digits a postcode has in it.
  if (line !== PHONE.trim()) return null;
  if (!/^[\d\s()+.\-]+$/.test(line)) return null;
  const digits = line.replace(/\D/g, '');
  if (digits.length < 7) return null;
  // The country code is carried through if somebody configured one and is never added
  // here. A `tel:` with a guessed +1 in front of it is a number that dials somewhere.
  return `tel:${line.trim().startsWith('+') ? '+' : ''}${digits}`;
}

/** When the privacy notice was last gone through. Rendered on the page. */
export const PRIVACY_LAST_REVIEWED = '2026-11-23';

/**
 * The commitments in the privacy notice that this codebase cannot make for itself.
 *
 * WHY THESE ARE DATA AND NOT SENTENCES. A privacy notice is the one page on the site
 * where a plausible sentence is worse than a blank: "we keep enquiries for ninety days"
 * is a promise about a deletion routine that does not exist in this application, and
 * nobody reading the page can tell an invented figure from a decided one. A retention
 * period, the address a request goes to, and who processes the data on our behalf are
 * decisions for the operator and for counsel, not things to infer from the code.
 *
 * So each one is read from configuration, exactly as the business name is, and the page
 * prints a marked placeholder naming the variable and who has to fill it until somebody
 * does. The same shape as `brandBlockers()`: the unfilled state is visible on the page
 * rather than discoverable in a dashboard, and `tests/deadEnds.test.ts` asserts that
 * every one of these reaches the page through this list rather than being typed into it.
 */
export interface PrivacyCommitment {
  /** Stable, and what the page marks the placeholder with. */
  readonly id: string;
  /** The variable that fills it. */
  readonly env: string;
  /** What has to be supplied, said as the page would say it. */
  readonly needs: string;
  /** Who can decide it. Nobody else may. */
  readonly who: string;
  /** The configured value, or null while nobody has supplied one. */
  readonly value: string | null;
}

/**
 * Read as literals rather than through a loop over the names, because Next substitutes
 * `process.env.NEXT_PUBLIC_*` where it appears in the source and cannot follow an
 * indexed read. lib/brand.ts reads its own the same way and for the same reason.
 */
export function privacyCommitments(): PrivacyCommitment[] {
  const filled = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
  return [
    {
      id: 'retention',
      env: 'NEXT_PUBLIC_PRIVACY_RETENTION',
      needs: 'how long an enquiry, a referral or an application is kept, and what '
        + 'happens to it at the end of that',
      who: 'the operator, on advice from counsel',
      value: filled(process.env.NEXT_PUBLIC_PRIVACY_RETENTION),
    },
    {
      id: 'requests',
      env: 'NEXT_PUBLIC_PRIVACY_REQUESTS',
      needs: 'where a person sends a request to see, correct or remove what is held '
        + 'about them',
      who: 'the operator, on advice from counsel',
      value: filled(process.env.NEXT_PUBLIC_PRIVACY_REQUESTS),
    },
    {
      id: 'contact',
      env: 'NEXT_PUBLIC_PRIVACY_CONTACT',
      needs: 'who answers a question about this notice, and how to reach them',
      who: 'the operator',
      value: filled(process.env.NEXT_PUBLIC_PRIVACY_CONTACT),
    },
    {
      /*
       * Not inferable from the code, and the one commitment where silence reads as an
       * answer. Nothing in this application sends what a form collects anywhere but the
       * database and the operator's own console — the page says exactly that — but
       * whether the business sells or shares personal information, and what a person
       * does about it if it does, is a statement about the business and not about the
       * software. California's consumer privacy law (Civ. Code § 1798.100 and
       * following) wants it said plainly, and only the operator can say it.
       */
      id: 'sale',
      env: 'NEXT_PUBLIC_PRIVACY_SALE',
      needs: 'what the business says about selling or sharing personal information, '
        + 'and how to opt out if it does',
      who: 'the operator, on advice from counsel',
      value: filled(process.env.NEXT_PUBLIC_PRIVACY_SALE),
    },
    {
      id: 'processors',
      env: 'NEXT_PUBLIC_PRIVACY_PROCESSORS',
      needs: 'the companies that hold or carry this information on our behalf, named',
      who: 'the operator, from the deployment as it actually stands',
      value: filled(process.env.NEXT_PUBLIC_PRIVACY_PROCESSORS),
    },
  ];
}

/** The ones nobody has supplied. Each is printed on the page as a marked placeholder. */
export function unfilledCommitments(): PrivacyCommitment[] {
  return privacyCommitments().filter((c) => c.value === null);
}
