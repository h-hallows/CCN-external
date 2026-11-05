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
 */
export function NotPublished() {
  return (
    <main
      data-not-published="true"
      style={{
        minHeight: '60vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '3rem 1.5rem', textAlign: 'center',
      }}
    >
      <p style={{ color: 'var(--ink-2)', maxWidth: '28rem' }}>
        This site is not yet published.
      </p>
    </main>
  );
}
