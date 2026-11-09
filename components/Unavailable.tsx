import { PHONE, PENDING_PHONE, usingPlaceholderName } from '@/lib/brand';

/**
 * What a signed-in surface shows when the database is unreachable.
 *
 * It names no cause to a visitor. Whether a connection string is missing or a host is
 * down is not their business, and a public page is not the place to say.
 *
 * Before launch it does say, because the only person who can reach this deployment is
 * the one who deployed it, and "temporarily unavailable" on a site with no database is
 * a wild goose chase. The line disappears the moment a filed name is configured, which
 * is the same switch that lets the site be indexed.
 */
export function Unavailable({ what }: { what: string }) {
  const phone = PHONE !== PENDING_PHONE ? PHONE : null;
  return (
    <div className="wrap" style={{ maxWidth: '34rem', paddingBlock: '5rem' }}>
      <h1 style={{ fontSize: 'var(--step-2)' }}>{what} is temporarily unavailable</h1>
      <p style={{ color: 'var(--ink-2)' }}>
        We are looking at it. Nothing you have sent us is lost.
      </p>
      <p style={{ color: 'var(--ink-2)' }}>
        {phone
          ? <>If this is urgent, call us on {phone} — someone will pick up.</>
          : <>If this is urgent, please call us — someone will pick up.</>}
      </p>
      {usingPlaceholderName() ? (
        <p data-prelaunch-cause="true" style={{
          marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--line)',
          fontSize: 'var(--step--1)', color: 'var(--ink-3)',
        }}>
          Pre-launch: this deployment has no database. Add one in Vercel under
          Storage, apply the schema with <code>npm run db:deploy</code>, and the
          signed-in screens come up. The marketing pages do not need it.
        </p>
      ) : null}
    </div>
  );
}
