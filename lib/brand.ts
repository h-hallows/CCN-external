/**
 * The business name, in one place. Work order 01 § 3.
 *
 * The trading name is blocked on counsel — three provisions now: HSC § 1726(b),
 * 22 CCR § 74600(b), and Civil Code § 1812.533(b)(4), which bars presenting as a home
 * care agency by name, advertising *or other representation*. That would normally block
 * every marketing page.
 *
 * It does not have to. Nothing hardcodes a name; everything imports from here. When
 * counsel clears it, this is two environment variables rather than a find-and-replace
 * across sixty pages and six statutory documents.
 *
 * LEGAL_NAME is the registry's correct name as filed. It is the ONLY name that may
 * appear in statutory text — Civ. Code § 1812.5095(f), (d), (h) and § 1812.533(b)(2),
 * (b)(4). § 1812.533(b)(2) requires the "correct name" in every advertisement, so the
 * footer uses LEGAL_NAME and never a marketing name.
 *
 * DISPLAY_NAME is for marketing headings only, and only once counsel confirms a
 * registered DBA is acceptable. Until then it equals LEGAL_NAME.
 */

export const PENDING_LEGAL_NAME = 'PENDING_LEGAL_NAME';
export const PENDING_PHONE = 'PENDING_PHONE';

/**
 * What a deployment shows before anybody has filed a name.
 *
 * Three letters, which is the repository's own name for this business and could not be
 * mistaken for a trading name somebody registered. Not a plausible-looking invention:
 * a deployment that reads "Westside Concierge Nursing LLC" because a default said so
 * is a deployment somebody will eventually believe.
 *
 * The contact is prose rather than a number. A fake telephone number on a page is
 * worse than no number, because somebody can dial it.
 */
const PRELAUNCH_NAME = 'CCN';
const PRELAUNCH_CONTACT = 'Telephone pending';

/**
 * Read at module load, like the values below it. Next inlines `NEXT_PUBLIC_*` at build
 * time wherever it appears, so a constant and a function body get the same treatment;
 * `nameIsFiled()` exists as well because the tests drive both states in one process.
 */
const FILED_AT_BUILD = process.env.NEXT_PUBLIC_NAME_IS_FILED === '1';

export const LEGAL_NAME = process.env.NEXT_PUBLIC_LEGAL_NAME
  ?? (FILED_AT_BUILD ? PENDING_LEGAL_NAME : PRELAUNCH_NAME);
export const DISPLAY_NAME = process.env.NEXT_PUBLIC_DISPLAY_NAME ?? LEGAL_NAME;
export const PHONE = process.env.NEXT_PUBLIC_PHONE
  ?? (FILED_AT_BUILD ? PENDING_PHONE : PRELAUNCH_CONTACT);
export const STREET = process.env.NEXT_PUBLIC_STREET ?? null;

/**
 * The person a partner referral is acknowledged by. Web build spec § 4.3: the
 * acknowledgement "names a real person and gives a direct line".
 *
 * That is the whole trust mechanism of the partner programme — a discharge planner
 * sending a family somewhere wants to know who picked it up, not that "your request is
 * important to us". Unset, the acknowledgement omits the name rather than printing a
 * placeholder: no name is better than a fake one.
 */
export const OPERATOR_NAME = process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim() || null;

/**
 * Whether the configured name is the registry's name AS FILED, or a stand-in.
 *
 * Two different questions were being answered by one variable. "Is a name configured"
 * decides whether a page can render at all; "is that name the filed one" decides
 * whether the page may be advertised. Setting `NEXT_PUBLIC_LEGAL_NAME` to a placeholder
 * answered the first and silently answered the second too, so a site put up to be
 * looked at became a site search engines would index under a name nobody filed —
 * § 1812.533(b)(2) wants the correct name in every advertisement, and an indexed page
 * is about as advertised as a page gets.
 *
 * Separating them makes the safe state the default. A placeholder renders; it is never
 * indexed. When counsel clears the name, this is one more variable.
 */
export function nameIsFiled(): boolean {
  // Read at call time, like `legalNameResolved()` beside it. Next substitutes the
  // literal for `process.env.NEXT_PUBLIC_*` wherever it appears, so this is the same
  // build-time inlining a module constant would get — and it is assertable in both
  // states without reloading the module.
  return process.env.NEXT_PUBLIC_NAME_IS_FILED === '1';
}

/**
 * Whether search engines may index the marketing pages.
 *
 * Both halves are required: something to render, and a name somebody stands behind.
 */
export function indexable(): boolean {
  return brandBlockers().length === 0 && nameIsFiled();
}

/** Said in the footer while a stand-in is in use, so nobody mistakes it for the name. */
export function usingPlaceholderName(): boolean {
  return !nameIsFiled();
}

/** True once counsel has cleared a name and it is configured. */
export function legalNameResolved(): boolean {
  return LEGAL_NAME !== PENDING_LEGAL_NAME && LEGAL_NAME.trim().length > 0;
}

/**
 * Whether there is a telephone number somebody could actually dial.
 *
 * THERE ARE TWO STAND-INS AND THE CHECKS WERE READING THE WRONG ONE. `PHONE` falls back
 * to `PENDING_PHONE` once a filed name is claimed, and to the prose `PRELAUNCH_CONTACT`
 * — "Telephone pending" — before that. Every check compared against the first. So on the
 * deployment as it has been running, with no name filed, `PHONE` held the prose and
 * `PHONE !== PENDING_PHONE` was true: the site considered itself to have a telephone
 * number, and four screens served "call us on Telephone pending — someone will pick up."
 * `/api/health` reported `"contact": true` at the same time, which is the part that
 * would have kept anybody from going looking.
 *
 * One predicate now, and it asks the only question worth asking: did somebody configure
 * a number. Neither stand-in is one.
 */
function phoneConfigured(): boolean {
  return PHONE !== PENDING_PHONE
    && PHONE !== PRELAUNCH_CONTACT
    && PHONE.trim().length > 0;
}

/**
 * § 1812.533(b)(2) is satisfied by a street address OR a business telephone number.
 * Either will do; neither being present will not.
 */
export function contactResolved(): boolean {
  return phoneConfigured() || (STREET !== null && STREET.trim().length > 0);
}

/**
 * What the footer prints as the second required line.
 *
 * Deliberately still returns the prose stand-in before launch, and `tests/marketing.test.ts`
 * asserts it: a footer that prints nothing is a footer somebody ships without noticing,
 * and "Telephone pending" is true. This is the line to PRINT. Whether there is a contact
 * somebody can USE is `contactResolved()`, and the two had been collapsed into one.
 */
export function contactLine(): string {
  if (phoneConfigured()) return PHONE.trim();
  if (STREET && STREET.trim()) return STREET.trim();
  if (PHONE === PRELAUNCH_CONTACT) return PRELAUNCH_CONTACT;
  return '';
}

/** Everything the footer needs, and why it cannot render when it cannot. */
export function brandBlockers(): string[] {
  /*
   * Nothing is withheld before launch.
   *
   * § 1812.533(b)(2) governs ADVERTISEMENTS. A deployment nobody has been pointed at,
   * which tells every crawler to stay away and says on every page that its name is a
   * stand-in, is not advertising — it is somebody looking at their own software. The
   * check attaches to the moment that stops being true, which is the moment a name
   * somebody filed is configured.
   *
   * It is not weakened, only moved: with NEXT_PUBLIC_NAME_IS_FILED=1 and nothing else
   * set, every page is withheld exactly as before.
   */
  if (!nameIsFiled()) return [];

  const blockers: string[] = [];
  if (!legalNameResolved()) {
    blockers.push(
      'NEXT_PUBLIC_LEGAL_NAME is unset. The registry\'s correct name is required in '
      + 'every advertisement by § 1812.533(b)(2), and the trading name is blocked on '
      + 'counsel — HSC § 1726(b), 22 CCR § 74600(b), Civ. Code § 1812.533(b)(4).',
    );
  }
  if (!contactResolved()) {
    blockers.push(
      'Neither NEXT_PUBLIC_PHONE nor NEXT_PUBLIC_STREET is set. § 1812.533(b)(2) '
      + 'requires the name plus one of them in every advertisement.',
    );
  }
  return blockers;
}

/**
 * Metadata for a public page, withheld while the brand is.
 *
 * The marketing layout already refuses to render the body when `brandBlockers()` is
 * non-empty — but metadata is not part of the body, and on the live deployment it was
 * still going out: every title read "… · PENDING_LEGAL_NAME", an internal sentinel in
 * the browser tab and in every link preview, and each page still served its real
 * marketing description beneath a body saying the site is not published.
 *
 * A meta description IS advertising copy. § 1812.533(b)(2) requires the registry's
 * correct name in every advertisement, which is the whole reason the body is withheld,
 * so shipping the description while withholding the page is the same breach wearing a
 * different tag. Wrap every public page's metadata in this.
 */
export const NOT_PUBLISHED_TITLE = 'Not yet published';

export function publicMetadata<T extends Record<string, unknown>>(
  base: T,
  /**
   * The route this metadata is for, as the canonical URL.
   *
   * Required, and that is the whole fix. The root layout sets
   * `alternates: { canonical: '/' }`, which Next inherits — so seven of the eight public
   * pages were declaring the HOMEPAGE as their canonical URL. Invisible today because
   * every page is `noindex` until a filed name is configured; the day the name lands it
   * collapses the entire marketing site to one indexable URL, and the crossed landing
   * pages — the whole point of which is to rank for a service in an area — point at
   * somewhere else.
   *
   * `tests/marketing.test.ts` already asserted canonicals were absolute, which they
   * were. It did not ask whether they were right. A required argument is what stops the
   * next page from inheriting it, because a page cannot forget to pass one.
   */
  canonicalPath: string,
): T {
  const withCanonical = {
    ...base,
    alternates: { ...(base.alternates as object ?? {}), canonical: canonicalPath },
  } as T;
  base = withCanonical;

  if (brandBlockers().length > 0) {
    return {
      ...base,
      title: { absolute: NOT_PUBLISHED_TITLE },
      description: undefined,
      openGraph: undefined,
      robots: { index: false, follow: false },
    } as unknown as T;
  }

  /*
   * The page renders — a name is configured — but nobody has said it is the filed one,
   * so the description and the title go out and the crawler is told not to keep them.
   * Someone looking at the site sees the real thing; a search engine does not file it
   * under a name that may change.
   */
  if (!nameIsFiled()) {
    return { ...base, robots: { index: false, follow: false } } as unknown as T;
  }

  return base;
}
