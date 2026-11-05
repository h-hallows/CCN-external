import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getPortalSession } from '@/lib/session';
import { BLOCK_LABEL, providerSelf } from '@/lib/pro';
import { AREA_LABEL } from '@/lib/opportunities';
import { Wrap } from '@/components/layout';

export const dynamic = 'force-dynamic';

/**
 * The document title is the provider's name, not ours.
 *
 * Browsers print the page title in the header by default, so leaving the registry's
 * name there would put it across the top of every printed copy — undoing the one thing
 * this page is for. § 1812.5095(b)(1)(C): the provider is free to work for others, and
 * a résumé that advertises us at an interview with somebody else does not demonstrate
 * that, it contradicts it.
 */
export async function generateMetadata(): Promise<Metadata> {
  const session = await getPortalSession();
  const me = session ? await providerSelf(session) : null;
  const name = me?.preferredName ?? me?.fullName;
  return {
    // `absolute` on purpose: the root layout appends the site name through a title
    // template, which would put the registry back into the printed header — the exact
    // thing this is here to prevent.
    title: { absolute: name ? `${name} — ${me?.type}` : 'Résumé' },
    robots: { index: false, follow: false },
  };
}

/**
 * § 4.2 /pro/resume — "Generates a clean PDF from the structured profile, for the
 * provider's own use anywhere, including with other agencies. This is the product
 * expression of § 1812.5095(b)(1)(C)."
 *
 * THAT LAST SENTENCE IS THE DESIGN BRIEF. (b)(1)(C) is one of the nine factors keeping
 * a referred provider from being treated as an employee: they are free to work for
 * others. A résumé that only works here, or that carries our name across the top, would
 * undercut the thing it exists to demonstrate. So this page is theirs: their name,
 * their words, their credentials, and no registry branding, no "referred by", no
 * footer, no watermark.
 *
 * It is a print view rather than a generated PDF file. No PDF library is a dependency,
 * and adding one to lay out a single page of text would be a lot of machinery for a
 * worse result — browsers already produce clean PDFs from print stylesheets, with
 * selectable text and the person's own paper size. Print, or save as PDF, and the
 * output is the same either way.
 *
 * What is deliberately NOT here: anything we think about them. No rating, no reliability
 * figure, no "verified by" badge, no completion percentage. Listing what we confirmed
 * and when is a fact about a document; a badge is an endorsement, and an endorsement
 * that lives on their résumé is a leash.
 */
export default async function ProResume() {
  const session = await getPortalSession();
  if (!session) redirect('/login');
  const me = await providerSelf(session);
  if (!me) redirect('/login');

  const openBlocks = (() => {
    const byBlock = new Map<string, string[]>();
    for (const slot of me.availability) {
      const [day, block] = slot.split(':');
      if (!day || !block) continue;
      byBlock.set(block, [...(byBlock.get(block) ?? []), day]);
    }
    return [...byBlock.entries()].map(
      ([block, days]) => `${BLOCK_LABEL[block] ?? block}: ${days.join(', ')}`);
  })();

  return (
    <>
      <Wrap>
        <div className="resume-controls" style={{ paddingBlock: '1.5rem' }}>
          <Link href="/pro" style={{ fontSize: 'var(--step--1)' }}>&larr; Back</Link>
          <p style={{
            marginTop: '1rem', maxWidth: 'var(--measure)', fontSize: 'var(--step--1)',
            color: 'var(--ink-2)',
          }}>
            This is yours. Print it or save it as a PDF and use it wherever you like,
            including with other agencies — our name is not on it and nothing here is
            our opinion of you. It is built from what you have told us, so it changes
            when you change your profile.
          </p>
        </div>
      </Wrap>

      <article data-print="resume" className="resume">
        <header>
          <h1>{me.preferredName ?? me.fullName}</h1>
          <p className="resume-type">
            {me.type}
            {me.licenseState && me.type !== 'companion' ? <> &middot; {me.licenseState}</> : null}
          </p>
        </header>

        {me.bio ? (
          <section>
            <h2>About my work</h2>
            <p>{me.bio}</p>
          </section>
        ) : null}

        {me.specialties.length > 0 ? (
          <section>
            <h2>Experience</h2>
            <p>{me.specialties.map((s) => s.replace(/_/g, ' ')).join(' · ')}</p>
          </section>
        ) : null}

        {me.languages.length > 0 ? (
          <section>
            <h2>Languages</h2>
            <p>{me.languages.join(', ')}</p>
          </section>
        ) : null}

        {me.areas.length > 0 ? (
          <section>
            <h2>Where I work</h2>
            <p>{me.areas.map((a) => AREA_LABEL[a] ?? a).join(' · ')}</p>
          </section>
        ) : null}

        {openBlocks.length > 0 ? (
          <section>
            <h2>When I am generally open to work</h2>
            <ul>{openBlocks.map((b) => <li key={b}>{b}</li>)}</ul>
          </section>
        ) : null}

        {me.restrictions ? (
          <section>
            <h2>What I do not take on</h2>
            <p>{me.restrictions}</p>
          </section>
        ) : null}

        <section>
          <h2>Contact</h2>
          <p>
            {[me.phone, me.email].filter(Boolean).join(' · ') || 'Available on request'}
          </p>
        </section>
      </article>
    </>
  );
}
