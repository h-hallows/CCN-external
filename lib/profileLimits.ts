/**
 * Constants the household profile editor and the server share.
 *
 * Its own module because `components/HouseholdProfile.tsx` is a client component, and
 * importing this from `lib/caseProfile.ts` pulled that module's import of `portalDb` →
 * `session` → `next/headers` into the client bundle and broke the production build.
 * Typecheck and the test suite both pass in that state: tests import server modules
 * directly under node, and the constraint is the bundler's rather than TypeScript's.
 * A shared value between a client component and a server module belongs somewhere with
 * no server imports of its own.
 */

/** Long enough for anything worth saying, short enough not to be a document store. */
export const PROFILE_MAX = 8000;
