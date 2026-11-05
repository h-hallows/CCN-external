import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getPortalSession } from '@/lib/session';
import { databaseAvailable } from '@/lib/availability';
import { Unavailable } from '@/components/Unavailable';
import { Wrap } from '@/components/layout';
import { signOut } from '@/app/signOut';
import { DISPLAY_NAME } from '@/lib/brand';

/** Invite-only, dynamic, never indexed. Spec § 4.3 and § 6.2. */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const available = await databaseAvailable();
  if (!available.ok) return <Unavailable what="The partner view" />;

  const session = await getPortalSession();
  if (!session) redirect('/login');
  if (session.role !== 'partner') {
    redirect(session.role === 'household' ? '/portal' : '/pro');
  }

  return (
    <div data-surface="portal" style={{ minHeight: '100vh', background: 'var(--paper)', color: 'var(--ink)' }}>
      <header style={{ borderBottom: '1px solid var(--line)' }}>
        <Wrap>
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
            gap: '1.25rem', paddingBlock: '1rem',
          }}>
            <Link href="/partner" style={{
              fontFamily: 'var(--display)', color: 'var(--ink)', textDecoration: 'none',
            }}>
              {DISPLAY_NAME}
            </Link>
            {/*
              * One link, and it is to the form. There is no balance, no statement and
              * no rewards tab, because there is nothing to put in one — § 1812.531.
              */}
            <nav style={{ display: 'flex', gap: '1.1rem', fontSize: 'var(--step--1)' }}>
              <Link href="/refer" style={{ color: 'var(--ink-2)' }}>Refer a patient</Link>
            </nav>
            <span className="label" style={{ marginLeft: 'auto' }}>{session.displayName}</span>
            <form action={signOut}>
              <button
                type="submit"
                style={{
                  background: 'none', border: 0, padding: 0, cursor: 'pointer',
                  font: 'inherit', fontSize: 'var(--step--1)', color: 'var(--ink-3)',
                  textDecoration: 'underline', textUnderlineOffset: '3px',
                }}
              >
                Sign out
              </button>
            </form>
          </div>
        </Wrap>
      </header>
      <main><Wrap>{children}</Wrap></main>
    </div>
  );
}
