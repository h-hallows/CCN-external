'use client';

import Link from 'next/link';
import { brandBlockers, contactLine } from '@/lib/brand';
import { NotPublished } from '@/components/NotPublished';
import { StatutoryFooter } from '@/components/StatutoryFooter';
import { Main, Prose, Section, Stack, Wrap } from '@/components/layout';
import { telHref } from '@/lib/site';

/**
 * What a visitor gets when a page throws.
 *
 * Same failure as app/not-found.tsx and the same reasoning about where it sits: there
 * was no error boundary anywhere in the application, so anything thrown while rendering
 * served the framework's default page. This one renders inside the root layout, carries
 * its own statutory footer because it is a public page of this business, and serves the
 * holding page in every state where the marketing routes are withheld.
 *
 * IT NAMES NO CAUSE. `error` is in the signature because Next passes it and not because
 * anything here prints it: whether a connection string is missing or a query timed out
 * is not a visitor's business, and components/Unavailable.tsx already holds that line —
 * a test there asserts the rendered page leaks neither a variable name nor a Postgres
 * error. Next logs the real one on the server, where somebody can act on it.
 *
 * `reset` re-renders the segment. It is offered first because a transient failure — a
 * database that blipped during a render — is the common case, and trying again is both
 * the cheapest thing to try and the one thing a visitor cannot do for themselves from a
 * dead page.
 */
export default function Error({ reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (brandBlockers().length > 0) return <NotPublished />;

  const tel = telHref();

  /*
   * `Main` and the footer outside it, for the reason app/not-found.tsx records: a
   * boundary at app/ renders inside the root layout, so without this every word on the
   * page is outside every landmark — and a `<footer>` inside `<main>` stops being a
   * `contentinfo` landmark, so the footer cannot go in with it.
   */
  return (
    <>
      <Main>
        <Wrap>
          <Stack gap="lg">
            <Section title="This page did not load" as="h1">
              <Prose>
                <p className="lede">
                  Something at our end stopped part-way. It is not anything you did, and
                  nothing you have already sent us is affected.
                </p>
                <p>
                  <button type="button" onClick={reset} className="btn btn-primary">
                    Try the page again
                  </button>
                </p>
                <p>
                  If it does the same thing twice, go back to the{' '}
                  <Link href="/">home page</Link>, or{' '}
                  <Link href="/enquire">tell us what is needed</Link> and we will call you
                  back — that form is a different part of the site and will be working.
                </p>
                {/*
                  * As on the 404: a number only when there is one to dial, printed from the
                  * line the footer prints and dialled from its digits.
                  */}
                {tel ? (
                  <p>
                    If it is urgent, call us on{' '}
                    <a href={tel} className="nums">{contactLine()}</a> — someone will pick
                    up.
                  </p>
                ) : null}
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
