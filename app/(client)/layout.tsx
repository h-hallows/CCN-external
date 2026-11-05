import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getPortalSession } from '@/lib/session';
import { databaseAvailable } from '@/lib/availability';
import { Unavailable } from '@/components/Unavailable';
import { Wrap } from '@/components/layout';
import { DISPLAY_NAME } from '@/lib/brand';

/** Dynamic, server-rendered, never indexed. Spec § 6.2. */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

/*
 * Plain words, in the order a household needs them. No icons and no counts: a badge
 * saying "2" next to Requests turns a family's care into a queue to clear.
 */
const NAV = [
  { href: '/portal', label: 'Your short list' },
  { href: '/portal/schedule', label: 'Schedule' },
  { href: '/portal/requests', label: 'Requests' },
  { href: '/portal/profile', label: 'About your household' },
  { href: '/portal/documents', label: 'Documents' },
];

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  // Guards everything beneath it, so no portal page has to repeat the check.
  const available = await databaseAvailable();
  if (!available.ok) return <Unavailable what="Your portal" />;

  const session = await getPortalSession();
  if (!session) redirect('/login');
  if (session.role !== 'household') redirect(session.role === 'provider' ? '/pro' : '/login');

  return (
    <div data-surface="portal" style={{ minHeight: '100vh', background: 'var(--paper)', color: 'var(--ink)' }}>
      <header style={{ borderBottom: '1px solid var(--line)' }}>
        <Wrap>
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
            gap: '1.25rem', paddingBlock: '1rem',
          }}>
            <Link href="/portal" style={{
              fontFamily: 'var(--display)', color: 'var(--ink)', textDecoration: 'none',
            }}>
              {DISPLAY_NAME}
            </Link>
            <nav style={{
              display: 'flex', flexWrap: 'wrap', gap: '1.1rem',
              fontSize: 'var(--step--1)',
            }}>
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} style={{ color: 'var(--ink-2)' }}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <span className="label" style={{ marginLeft: 'auto' }}>{session.displayName}</span>
          </div>
        </Wrap>
      </header>
      <main><Wrap>{children}</Wrap></main>
    </div>
  );
}
