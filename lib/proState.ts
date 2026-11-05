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
