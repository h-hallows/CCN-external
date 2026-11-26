/**
 * What a marketing route serves while it cannot legally be an advertisement.
 *
 * § 1812.533(b)(2) requires the registry's correct name plus a street address or
 * business telephone in EVERY advertisement, and a public marketing page is one. Until
 * both exist, serving the page would be the violation — so the page is not served.
 *
 * This holding page is deliberately not an advertisement itself: no business name, no
 * description of services, no claim of any kind. There is nothing here for the statute
 * to attach to.
 *
 * THE ONE SENTENCE IS THE HEADING, which it was not. This was a `<p>` and nothing else,
 * so the holding page was the only page on the site with no `h1` — a document a screen
 * reader is handed with no title and no outline, which is the state the deployment is
 * actually in whenever a filed name is claimed and nothing else is configured. An `h1`
 * is not an advertisement: it names no business and offers no service, and the sentence
 * it holds is the same sentence. It is sized down to --step-1 rather than left at the
 * h1 default, because this page says one quiet thing and should not shout it.
 *
 * `id` and `tabIndex` match components/layout.tsx's `Main`, and the landmark is written
 * out here rather than imported because this page is also what the marketing layout
 * serves INSTEAD of that layout's own `Main` — importing it would nest one landmark in
 * another on the routes that render through it.
 */
import { MAIN_ID } from '@/components/layout';

export function NotPublished() {
  return (
    <main
      id={MAIN_ID}
      tabIndex={-1}
      data-not-published="true"
      style={{
        minHeight: '60vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '3rem 1.5rem', textAlign: 'center',
      }}
    >
      <h1 style={{
        color: 'var(--ink-2)', maxWidth: '28rem', fontSize: 'var(--step-1)',
        fontWeight: 400, margin: 0,
      }}>
        This site is not yet published.
      </h1>
    </main>
  );
}
