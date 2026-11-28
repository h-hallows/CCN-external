import type { Metadata } from 'next';
import Link from 'next/link';
import { brandBlockers, contactLine, NOT_PUBLISHED_TITLE } from '@/lib/brand';
import { NotPublished } from '@/components/NotPublished';
import { StatutoryFooter } from '@/components/StatutoryFooter';
import { Main, Prose, Section, Stack, Wrap } from '@/components/layout';
import { telHref } from '@/lib/site';

/**
 * What a visitor gets at an address this site does not have.
 *
 * THE FAILURE THIS FILE IS ABOUT. There was no not-found.tsx and no error.tsx anywhere
 * in the application, so a mistyped URL — or a stale link to a `/care/[service]/[area]`
 * page whose content file has since been removed, which is a `notFound()` the crossed
 * page already calls — served the unstyled default Next error page. On the public front
 * of a business whose entire proposition is carefulness, the first thing a discharge
 * planner saw was somebody else's framework.
 *
 * WHY IT IS AT app/ AND NOT IN THE ROUTE GROUP. A not-found boundary replaces everything
 * below the segment it is declared in, so this one renders inside the ROOT layout and
 * not inside app/(marketing)/layout.tsx — no navigation, no CallToAction, and in
 * particular no statutory footer unless this page carries one itself. It does, because
 * the page below names the business through the layout's title template and offers to
 * arrange care, and § 1812.533(b)(2) wants the registry's correct name plus a contact in
 * EVERY advertisement.
 *
 * EVERY BRAND STATE, not just the one that renders. While `brandBlockers()` is non-empty
 * the marketing routes are withheld, and a dead end that offered "arrange care" at that
 * moment would be the one advertisement on the deployment — pointing, moreover, at pages
 * that are themselves serving the holding page. So this serves the same holding page they
 * do: no name, no services, no links, nothing for the statute to attach to.
 */
export const metadata: Metadata = {
  /*
   * Withheld with the body, for the reason lib/brand.ts's `publicMetadata` exists: a
   * title is advertising copy and goes out even when the body does not, and in the state
   * where a filed name is claimed and nothing is configured the template would put an
   * internal sentinel in the browser tab.
   */
  title: brandBlockers().length > 0
    ? { absolute: NOT_PUBLISHED_TITLE }
    : 'Page not found',
  /*
   * Never indexed, in any state. Next answers 404 here, but a crawler that follows a
   * stale link should also be told plainly, and the canonical the root layout sets for
   * itself must not be inherited: a 404 declaring the homepage as its canonical URL
   * invites exactly the collapse `publicMetadata` was written to stop.
   */
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function NotFound() {
  if (brandBlockers().length > 0) return <NotPublished />;

  const tel = telHref();

  /*
   * A `main` landmark, for the same reason this file carries its own statutory footer: a
   * boundary declared at app/ renders inside the ROOT layout, which has only `<body>` in
   * it — so everything on this page sat outside every landmark, and a screen reader
   * asked to jump to the main content of the page had nowhere to jump to. The marketing
   * layout's `<main>` is not inherited here, which is why it is a shared component
   * rather than three lines of markup in a layout.
   *
   * THE FOOTER STAYS OUTSIDE IT. A `<footer>` that descends from `<main>` is not a
   * `contentinfo` landmark — the mapping is only for a footer scoped to the document —
   * so wrapping the whole page in `Main` would have taken the statutory footer out of
   * the landmark list to put the body into it. There is no skip link here because there
   * is nothing to skip: this page has no header and no navigation.
   */
  return (
    <>
      <Main>
        <Wrap>
          <Stack gap="lg">
            <Section title="There is no page at that address" as="h1">
              <Prose>
                <p className="lede">
                  Either we have moved something, or the address has a character out of
                  place. Nothing has gone wrong at your end.
                </p>
                <p>
                  If you were reading about a particular kind of care in a particular area,
                  the <Link href="/">home page</Link> lists what we cover and it is a short
                  list. If you were on your way to us,{' '}
                  <Link href="/enquire">tell us what is needed</Link> — a few lines is
                  enough, and we call you back.
                </p>
                {/*
                  * Only when there is a number somebody could dial. `telHref()` returns
                  * null for both of the stand-ins and for a street address, which is the
                  * failure lib/brand.ts records: four screens served "call us on Telephone
                  * pending" because the checks compared against the wrong one. A dead end
                  * is a bad place to learn that a telephone number is prose.
                  */}
                {/*
                  * The number is PRINTED from `contactLine()` and DIALLED from `telHref()`,
                  * which is not a duplication: one is the line § 1812.533(b)(2) requires a
                  * page to carry and the other is a URL, and the href is built from the
                  * digits of that same line rather than from anything typed here. A
                  * telephone number written into this file is one that stops being the
                  * registry's the day it changes.
                  */}
                {tel ? (
                  <p>
                    If it is urgent, the telephone is faster than any of this:{' '}
                    <a href={tel} className="nums">{contactLine()}</a>.
                  </p>
                ) : null}
                <p style={{ color: 'var(--ink-2)' }}>
                  Most of what this site has to say is on{' '}
                  <Link href="/how-it-works">how it works</Link> and{' '}
                  <Link href="/vetting">what we check</Link>.
                </p>
              </Prose>
            </Section>
          </Stack>
        </Wrap>
      </Main>
      <Wrap>
        <StatutoryFooter />
      </Wrap>
    </>
  );
}
