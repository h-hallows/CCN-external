/**
 * What the provider-facing forms hand back. Its own module so the client components
 * that render it import no server code — see tests/clientPortal.test.ts for why that
 * boundary is tested rather than trusted.
 */
export type ProFormState =
  | { state: 'idle' }
  | { state: 'saved'; message: string }
  | { state: 'error'; message: string };

export const PRO_IDLE: ProFormState = { state: 'idle' };

export const SAVED = 'Saved.';

export const SAVE_FAILED =
  'We could not save that just now. Your words are still on this page — try again in a moment.';

export const NOT_YOURS =
  'That is not on your record. Sign in again if this looks wrong.';

/**
 * What went wrong with a handed-in file, said plainly.
 *
 * Separate strings rather than one "that did not work": a provider who photographed a
 * certificate on their phone and got a HEIC, or who scanned at 600 dpi and got 14 MB,
 * needs to know which of those happened. Telling them to try again tells them nothing.
 */
export const FILE_WRONG_TYPE =
  'We keep PDFs and photos — PDF, JPEG, PNG, HEIC or TIFF. If you have something else, '
  + 'a photo of it is fine.';

export const FILE_EMPTY = 'That file came through empty. Try attaching it again.';

export const FILE_TOO_BIG =
  'That file is over 10 MB. A photo taken on your phone is usually well under it; a '
  + 'scan at a lower setting will be too.';

/**
 * § 1812.530. A nurses' registry may not charge a fee to the nurse.
 *
 * ONE STRING, IN ONE MODULE, for the same reason lib/requestState.ts keeps its copy
 * here and says so: a rule asserted over a whole surface is only worth having if there
 * is a single place the wording can be checked against. Written twice in slightly
 * different words, it drifts, and it had.
 *
 * WHAT THE DRIFT WAS, because it is the exact shape this project is organised against.
 * The reassurance existed and was correct and was on the wrong page. /pro/fee-schedule
 * printed it in the branch for a CNA, HCA or companion — who has no posted schedule,
 * no figure in front of them and no § 1812.527 obligation attaching to them at all —
 * and said nothing about who pays in the branch that actually renders "35% maximum"
 * and a set of payment terms to a registered or licensed vocational nurse. So the one
 * person the statute protects was the one person not told, on the one screen where a
 * percentage appears next to their name. Present, correct, and never reached by the
 * reader it was written for.
 *
 * Nothing in it may read as a deduction, a share or a condition. The fee is the
 * household's, it is charged on the cost of the engagement, and the provider's hours
 * are not part of the arithmetic.
 */
export const NO_FEE_TO_YOU =
  'Our fee is charged to the household, as a percentage of the cost of the engagement. '
  + 'You are never charged a fee of any kind for being referred, and nothing is ever '
  + 'taken out of what you are paid.';
