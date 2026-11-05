import Link from 'next/link';
import { StatutoryFooter } from '@/components/StatutoryFooter';
import { Wrap } from '@/components/layout';
import { brandBlockers, DISPLAY_NAME } from '@/lib/brand';
import { NotPublished } from '@/components/NotPublished';
import type { Metadata } from 'next';

/*
 * While the site is withheld there is nothing worth indexing, and an indexed holding
 * page outranks the real one for a while once it is published.
 */
export const metadata: Metadata = brandBlockers().length > 0
  ? { robots: { index: false, follow: false } }
  : {};

const NAV = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/pricing', label: 'Rates' },
  { href: '/vetting', label: 'Vetting' },
  { href: '/for-providers', label: 'For providers' },
  { href: '/for-partners', label: 'For partners' },
];

/**
 * Every marketing route renders through here, which is what makes the statutory footer
 * unremovable — a page cannot opt out of its own layout.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  /*
   * § 1812.533(b)(2) requires the registry's correct name plus a street address or
   * business telephone in every advertisement, and a public marketing page is one.
   * Without them the page is not served at all — withholding it satisfies the statute,
   * where shipping it would breach it.
   *
   * This replaced throwing during the build. The throw was correct about the rule and
   * wrong about the remedy: it took the portals, the intake routes and the health check
   * down with the marketing pages, over a name that is waiting on a lawyer.
   */
  const blockers = brandBlockers();
  if (blockers.length > 0) {
    // Named in the server log as well as at /api/health. Someone looking at a deployed
    // holding page and wondering why should not have to already know which route to ask,
    // and the holding page itself is public and says nothing.
    console.warn(
      `[marketing] withheld — ${blockers.length} unmet requirement(s):\n  `
      + blockers.join('\n  '),
    );
    return <NotPublished />;
  }

  return (
    <>
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
        <Wrap>
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
            gap: '1.5rem', paddingBlock: '1.1rem',
          }}>
            <Link href="/" style={{
              fontFamily: 'var(--display)', fontSize: 'var(--step-1)',
              color: 'var(--ink)', textDecoration: 'none', letterSpacing: '-0.01em',
            }}>
              {DISPLAY_NAME}
            </Link>
            <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: 'var(--step--1)' }}>
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} style={{ color: 'var(--ink-2)' }}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </Wrap>
      </header>

      <main>
        <Wrap>{children}</Wrap>
      </main>

      <Wrap>
        <StatutoryFooter />
      </Wrap>
    </>
  );
}
