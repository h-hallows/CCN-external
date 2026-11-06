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
