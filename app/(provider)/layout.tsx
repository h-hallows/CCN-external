import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getPortalSession } from '@/lib/session';
import { databaseAvailable } from '@/lib/availability';
import { Unavailable } from '@/components/Unavailable';
import { Wrap } from '@/components/layout';
import { signOut } from '@/app/signOut';
import { DISPLAY_NAME } from '@/lib/brand';

/** Dynamic, server-rendered, never indexed. Spec § 6.2. */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

/*
 * What a provider needs and nothing else. There is no "training", no "performance", no
 * "my score" — I1, I2 and § 687.2(d)–(e). The absence is the product: a registry that
 * coached, scored or ranked its providers would be managing them.
 */
const NAV = [
  { href: '/pro', label: 'Your work' },
  { href: '/pro/engagements', label: 'Where you have worked' },
  { href: '/pro/profile', label: 'About you' },
  { href: '/pro/rate', label: 'Your rate' },
  { href: '/pro/availability', label: 'When you work' },
  { href: '/pro/limits', label: 'What you will not take' },
  { href: '/pro/credentials', label: 'Your documents' },
  { href: '/pro/resume', label: 'Your résumé' },
];

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const available = await databaseAvailable();
  if (!available.ok) return <Unavailable what="Your account" />;

  const session = await getPortalSession();
  if (!session) redirect('/login');
  if (session.role !== 'provider') redirect(session.role === 'household' ? '/portal' : '/login');

  return (
    <div data-surface="portal" style={{ minHeight: '100vh', background: 'var(--paper)', color: 'var(--ink)' }}>
      <header style={{ borderBottom: '1px solid var(--line)' }}>
        <Wrap>
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
            gap: '1.25rem', paddingBlock: '1rem',
          }}>
            <Link href="/pro" style={{
              fontFamily: 'var(--display)', color: 'var(--ink)', textDecoration: 'none',
            }}>
              {DISPLAY_NAME}
            </Link>
            <nav style={{
              display: 'flex', flexWrap: 'wrap', gap: '1.1rem', fontSize: 'var(--step--1)',
            }}>
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} style={{ color: 'var(--ink-2)' }}>
                  {item.label}
                </Link>
              ))}
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
