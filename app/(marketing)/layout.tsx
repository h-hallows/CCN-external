import Link from 'next/link';
import { StatutoryFooter } from '@/components/StatutoryFooter';
import { CallToAction } from '@/components/CallToAction';
import { Main, SkipLink, Wrap } from '@/components/layout';
import {
  brandBlockers, contactLine, contactResolved, DISPLAY_NAME, indexable,
} from '@/lib/brand';
import { telHref } from '@/lib/site';
import { NotPublished } from '@/components/NotPublished';
import type { Metadata } from 'next';

/*
 * Nothing is indexed until a name somebody filed is configured.
 *
 * Two separate reasons, and the second is the one that is easy to miss. While the site
 * is withheld there is nothing worth indexing, and an indexed holding page outranks the
 * real one for a while once it is published. And once a stand-in name is configured the
 * pages render in full — which is the point — but a crawler cannot tell a stand-in from
 * the filed name, and § 1812.533(b)(2) wants the correct one in every advertisement.
 */
export const metadata: Metadata = indexable()
  ? {}
  : { robots: { index: false, follow: false } };

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

  const tel = telHref();

  return (
    <>
      {/*
        * Before the header, because the tab order it exists to shortcut is the document
        * order. Every marketing page opens with the wordmark, five navigation links and
        * two header actions, so the enquiry form's first field was the ninth tab stop.
        */}
      <SkipLink />
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
        <Wrap>
          <div className="site-head">
            <Link href="/" style={{
              fontFamily: 'var(--display)', fontSize: 'var(--step-1)',
              color: 'var(--ink)', textDecoration: 'none', letterSpacing: '-0.01em',
            }}>
              {DISPLAY_NAME}
            </Link>
            <nav aria-label="Main">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} style={{ color: 'var(--ink-2)' }}>
                  {item.label}
                </Link>
              ))}
            </nav>
            {/*
              * The one action in the header, and the first one the site has had. A
              * telephone number beside it when there is one to print — § 1812.533(b)(2)
              * makes it required somewhere on the page anyway, and the top right is
              * where somebody with a discharge on Friday afternoon looks first.
              */}
            {/*
              * DIALLED, NOT PRINTED, WHEN THERE IS A NUMBER. This was a `span`: the one
              * telephone number on the page, in the top right, read by somebody holding
              * a phone in a hospital corridor — and they had to memorise it and type it
              * into the dialler. `telHref()` is null for both stand-ins and for a street
              * address, which is why the printed line and the href are two calls rather
              * than one: § 1812.533(b)(2) wants the line on the page whether or not it is
              * dialable, and a `tel:` built from a street address is a dead link.
              */}
            <div className="head-actions">
              {contactResolved() ? (
                tel ? (
                  <a href={tel} className="nums" style={{
                    fontSize: 'var(--step--1)', color: 'var(--ink-2)',
                  }}>
                    {contactLine()}
                  </a>
                ) : (
                  <span className="nums" style={{
                    fontSize: 'var(--step--1)', color: 'var(--ink-2)',
                  }}>
                    {contactLine()}
                  </span>
                )
              ) : null}
              <Link href="/enquire" className="btn btn-primary">Arrange care</Link>
            </div>
          </div>
        </Wrap>
      </header>

      <Main>
        <Wrap>{children}</Wrap>
      </Main>

      <Wrap>
        <CallToAction />
        <StatutoryFooter />
      </Wrap>
    </>
  );
}
