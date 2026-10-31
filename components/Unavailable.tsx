import { PHONE, PENDING_PHONE } from '@/lib/brand';

/**
 * What a signed-in surface shows when the database is unreachable.
 *
 * It names no cause. A visitor does not need to know whether a connection string is
 * missing or a host is down, and a public page is not the place to say.
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
    </div>
  );
}
