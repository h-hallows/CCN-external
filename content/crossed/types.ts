/**
 * Service × area pages. Web build spec § 5, milestone W10.
 *
 * "Ten pages that rank, not sixty that do not." The content is editorial, lives in the
 * repository, and is versioned and reviewed like code.
 *
 * WHY THESE ARE TypeScript AND NOT MDX. § 5 specifies
 * `content/crossed/<service>--<area>.mdx` with YAML frontmatter, and the reasons it
 * gives — in the repository, versioned, reviewed, never in the database — are served
 * identically here. What is not served identically is the gate. § 5 ends: "A crossed
 * page needs at least two items in localContext, two in commonCases and three
 * questions or the build fails that page. That gate is what stops templated filler."
 *
 * With frontmatter that means parsing YAML, hoping the shapes match, and discovering a
 * missing field at request time. As typed modules, `tsc` rejects a page that omits a
 * field before anything runs, and `assertComplete` below rejects one that has the
 * fields but not enough in them — at import, so a short page fails `next build` rather
 * than rendering thin. It also matches `content/statutory/`, which made the same
 * choice for the same reason.
 *
 * The cost is that prose is written in template literals instead of Markdown. For ten
 * hand-written pages of a few paragraphs each, that is a smaller price than an MDX
 * toolchain and a frontmatter parser.
 */

export interface CrossedQuestion {
  q: string;
  a: string;
}

export interface CrossedPage {
  /** Slug, and the first path segment. */
  service: string;
  /** Slug, and the second path segment. */
  area: string;
  title: string;
  /** Meta description. Under 160 characters or the build fails. */
  summary: string;
  /**
   * What is true about care in this specific place. At least two.
   *
   * The bar is that a sentence could not be moved to another page unchanged. That is
   * the whole purpose of the minimum: filler is what you get when a page is generated
   * from a template with the place name swapped.
   */
  localContext: string[];
  /** The situations that actually arrive from this area. At least two. */
  commonCases: string[];
  /** At least three, answered properly. These become FAQPage structured data. */
  questions: CrossedQuestion[];
  /** Resolves against the live `rate_ranges` table. Never a figure in the content. */
  rateKey: string;
  /** When a person last read this page and stood behind it. */
  reviewedOn: string;
  /** Body prose, one string per paragraph. */
  body: string[];
}

export const MIN_LOCAL_CONTEXT = 2;
export const MIN_COMMON_CASES = 2;
export const MIN_QUESTIONS = 3;
export const MAX_SUMMARY = 160;

/**
 * A money figure in page content.
 *
 * § 5: rate ranges are never written into content, because a published rate that has
 * drifted from reality is both a conversion problem and, under § 1812.533(b)(1), a
 * misleading advertisement. The number on the page comes from `rate_ranges`, which the
 * operator maintains, revalidated hourly.
 */
export const MONEY = /\$\s?\d|\b\d{2,3}\s*(?:dollars|an hour|per hour|\/\s*hr)\b/i;

/**
 * Throws on anything short, templated or priced. Called at module load, so an
 * incomplete page fails the build rather than rendering thin.
 */
export function assertComplete(page: CrossedPage): CrossedPage {
  const where = `${page.service}--${page.area}`;
  const fail = (why: string): never => {
    throw new Error(`crossed page ${where}: ${why}`);
  };

  if (page.summary.length > MAX_SUMMARY) {
    fail(`summary is ${page.summary.length} characters; the limit is ${MAX_SUMMARY}`);
  }
  if (page.localContext.length < MIN_LOCAL_CONTEXT) {
    fail(`has ${page.localContext.length} localContext items; ${MIN_LOCAL_CONTEXT} is the minimum`);
  }
  if (page.commonCases.length < MIN_COMMON_CASES) {
    fail(`has ${page.commonCases.length} commonCases; ${MIN_COMMON_CASES} is the minimum`);
  }
  if (page.questions.length < MIN_QUESTIONS) {
    fail(`has ${page.questions.length} questions; ${MIN_QUESTIONS} is the minimum`);
  }
  if (page.body.length === 0) fail('has no body');

  // A heading with nothing under it is the shape filler takes once a minimum exists.
  for (const [field, items] of Object.entries({
    localContext: page.localContext,
    commonCases: page.commonCases,
    body: page.body,
  })) {
    items.forEach((item, i) => {
      if (item.trim().length < 20) fail(`${field}[${i}] is too short to say anything`);
    });
  }
  page.questions.forEach((question, i) => {
    if (question.q.trim().length < 10) fail(`questions[${i}].q is too short`);
    if (question.a.trim().length < 40) fail(`questions[${i}].a does not answer it`);
  });

  const everything = [
    page.summary, ...page.localContext, ...page.commonCases, ...page.body,
    ...page.questions.flatMap((question) => [question.q, question.a]),
  ].join('\n');
  const money = MONEY.exec(everything);
  if (money) fail(`names a rate ("${money[0]}"); rates come from rate_ranges`);

  return page;
}
