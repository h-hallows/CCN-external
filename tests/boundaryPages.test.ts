/**
 * The three dead ends: app/not-found.tsx, app/error.tsx and app/global-error.tsx.
 *
 * THEY HAD NO TEST OF ANY KIND. Not a route-registration check, not a render — nothing
 * in tests/ named them. They were written in the last pass against a real defect (a
 * mistyped URL, or a stale link to a `/care/[service]/[area]` page whose content file
 * has since been removed, served the framework's own unstyled error page on the public
 * front of a business whose whole proposition is carefulness) and then shipped on the
 * strength of having been read.
 *
 * WHAT MAKES THEM DIFFERENT FROM A PAGE, and therefore what is worth asserting:
 *
 *   1. A boundary declared at app/ replaces everything below the segment it is declared
 *      in. These render inside the ROOT layout and NOT inside app/(marketing)/layout.tsx
 *      — so no navigation, no CallToAction, no main landmark and no statutory footer
 *      unless the page carries them itself. § 1812.533(b)(2) wants the registry's
 *      correct name plus a contact in every advertisement, and a page that names the
 *      business through the title template and offers to arrange care is one.
 *   2. They are the pages most likely to be reached in the state nobody tests, because
 *      the state nobody tests is the state that breaks. So every assertion here is made
 *      in BOTH brand states: the one where a filed name and a contact are configured,
 *      and the one where `NEXT_PUBLIC_NAME_IS_FILED=1` is set and nothing else is — in
 *      which the marketing routes are withheld and a dead end offering "arrange care"
 *      would be the single advertisement on the deployment, pointing at pages that are
 *      themselves serving the holding page.
 *   3. app/global-error.tsx replaces the root layout, so it is the only page in the
 *      application that renders its own `<html>` and `<body>`, and the only one whose
 *      `lang` is not inherited.
 *
 * THE BRAND STATE IS DRIVEN THROUGH THE ENVIRONMENT AND A FRESH MODULE REGISTRY, not by
 * stubbing `brandBlockers`. lib/brand.ts reads `NEXT_PUBLIC_*` at module load for the
 * values and at call time for the predicates, because Next inlines them at build time —
 * so a stub would test a function this application never calls that way. `vi.resetModules`
 * plus a re-import is what actually re-runs that file.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* As in tests/pricingFeeSchedule.test.ts: the JSX here compiles to
 * `React.createElement`, and nothing in the application imports React because Next
 * provides it. */
(globalThis as unknown as { React: typeof React }).React = React;

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
/** Comments explain what a page may not say; only the rendered page may not say it. */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

/** What Next hands an error boundary. Distinctive on purpose — see `render` below. */
const THROWN = Object.assign(
  new Error('relation "inquiries" does not exist'),
  { digest: '3051176579' },
);

/** The environment the suite's setup leaves behind, restored after each state change. */
const BASELINE = {
  NEXT_PUBLIC_LEGAL_NAME: process.env.NEXT_PUBLIC_LEGAL_NAME,
  NEXT_PUBLIC_PHONE: process.env.NEXT_PUBLIC_PHONE,
  NEXT_PUBLIC_STREET: process.env.NEXT_PUBLIC_STREET,
  NEXT_PUBLIC_NAME_IS_FILED: process.env.NEXT_PUBLIC_NAME_IS_FILED,
};

afterEach(() => {
  for (const [key, value] of Object.entries(BASELINE)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
});

/**
 * Render a boundary page with the environment set to one brand state.
 *
 * `vi.resetModules()` before the import is the load-bearing line: lib/brand.ts captures
 * LEGAL_NAME and PHONE in module constants, so a module left in the registry from the
 * previous state would answer with the previous state's values and every assertion below
 * would be about the same page twice.
 */
async function render(
  module: string,
  environment: Record<string, string | undefined>,
): Promise<string> {
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
  const { default: Page } = await import(module) as {
    default: (props?: unknown) => React.ReactElement;
  };
  /*
   * A thrown message nothing on these pages would ever say for another reason, so
   * `not.toContain` is actually about the error rather than about the alphabet — the
   * first version of this used `new Error('x')` and asserted the page contained no "x".
   */
  return renderToStaticMarkup(Page({ error: THROWN, reset: () => {} }));
}

/** Configured and filed: the state the site is in once it is live. */
const PUBLISHED = {
  NEXT_PUBLIC_NAME_IS_FILED: '1',
  NEXT_PUBLIC_LEGAL_NAME: 'Test Registry LLC',
  NEXT_PUBLIC_PHONE: '(310) 555-0000',
  NEXT_PUBLIC_STREET: undefined,
};

/**
 * Claimed but unconfigured. `brandBlockers()` is non-empty, the marketing routes serve
 * the holding page, and these pages must do the same. This is the state a deployment
 * lands in the moment somebody sets the one variable that says "we have a name" before
 * setting the name — which is the realistic order.
 */
const WITHHELD = {
  NEXT_PUBLIC_NAME_IS_FILED: '1',
  NEXT_PUBLIC_LEGAL_NAME: undefined,
  NEXT_PUBLIC_PHONE: undefined,
  NEXT_PUBLIC_STREET: undefined,
};

/**
 * Before launch: no filed name claimed, a stand-in rendering, nothing indexed. The
 * deployment as it has actually been running. `brandBlockers()` is EMPTY here — the
 * check attaches to the moment a filed name is configured — so the pages render in full
 * with a stand-in name, and `telHref()` returns null because "Telephone pending" is
 * prose. That combination is the one four screens got wrong by comparing against the
 * wrong stand-in, and it is why it is a third state here and not an afterthought.
 */
const PRELAUNCH = {
  NEXT_PUBLIC_NAME_IS_FILED: undefined,
  NEXT_PUBLIC_LEGAL_NAME: undefined,
  NEXT_PUBLIC_PHONE: undefined,
  NEXT_PUBLIC_STREET: undefined,
};

const BOUNDARIES: [string, string][] = [
  ['the 404', '@/app/not-found'],
  ['the error boundary', '@/app/error'],
];

describe('a dead end is still a page of this business', () => {
  for (const [name, module] of BOUNDARIES) {
    describe(name, () => {
      it('carries its own statutory footer, because no layout gives it one', async () => {
        const html = await render(module, PUBLISHED);
        /*
         * § 1812.5095(h) and § 1812.533(b)(2). The page names the business through the
         * root layout's title template and offers to arrange care, which makes it an
         * advertisement; the marketing layout that would normally supply the footer is
         * not in the tree, so the page carries one itself or carries none.
         */
        expect(html).toContain('data-statutory-footer="complete"');
        expect(html).toContain('is a referral agency.');
        expect(html).toContain('(310) 555-0000');
      });

      it('puts its words inside a main landmark, and the footer outside it', async () => {
        const html = await render(module, PUBLISHED);
        /*
         * The defect: there was no `<main>` on either of these, so every word on them
         * sat outside every landmark and "jump to the main content" had nowhere to go.
         * And the footer stays out of it — a `<footer>` descending from `<main>` is not
         * a contentinfo landmark, so the obvious fix would have swapped one missing
         * landmark for another.
         */
        const main = /<main id="([^"]+)" tabindex="-1">/.exec(html);
        expect(main, `${name} renders no main landmark`).toBeTruthy();
        const closed = html.indexOf('</main>');
        expect(closed).toBeGreaterThan(0);
        expect(html.slice(0, closed), `${name} puts the footer inside the main`)
          .not.toContain('<footer');
        expect(html.slice(closed)).toContain('<footer');
      });

      it('has exactly one h1 and offers a way out that is not this page', async () => {
        const html = await render(module, PUBLISHED);
        expect((html.match(/<h1/g) ?? []).length).toBe(1);
        // The whole point of these pages. A dead end that is only an apology is the
        // framework's default page with better typography.
        expect(html).toMatch(/href="\/"/);
        expect(html).toMatch(/href="\/enquire"/);
      });

      it('dials the telephone number rather than printing it to be copied out', async () => {
        const html = await render(module, PUBLISHED);
        // Printed from `contactLine()`, dialled from `telHref()`'s digits — one is the
        // line the statute requires on the page, the other is a URL.
        expect(html).toContain('href="tel:3105550000"');
      });

      it('says nothing about a telephone when there is no number to dial', async () => {
        const html = await render(module, PRELAUNCH);
        /*
         * `PHONE` falls back to the prose "Telephone pending" before a filed name is
         * claimed, and to `PENDING_PHONE` after. Four screens compared against the
         * second and served "call us on Telephone pending — someone will pick up". A
         * dead end is a bad place to learn that a telephone number is prose.
         */
        expect(html).not.toContain('tel:');
        /*
         * THE BODY, NOT THE FOOTER. `contactLine()` deliberately still returns the
         * prose stand-in, and tests/marketing.test.ts asserts it: a statutory footer
         * that prints nothing is a footer somebody ships without noticing, and
         * "Telephone pending" is at least true. What must not happen is the BODY
         * inviting somebody to dial it. The two were one predicate once, which is the
         * whole reason `contactResolved()` and `contactLine()` are separate functions.
         */
        const body = html.slice(0, html.indexOf('</main>'));
        expect(body.toLowerCase()).not.toContain('telephone pending');
        expect(body.toLowerCase()).not.toContain('call us on');
        expect(body.toLowerCase()).not.toContain('the telephone is faster');
      });

      it('renders in full before launch — it is only indexing that waits', async () => {
        const html = await render(module, PRELAUNCH);
        // `brandBlockers()` is empty here by design: a deployment nobody has been
        // pointed at is not advertising. So the page is the page, with the stand-in.
        expect(html).toContain('<main');
        expect((html.match(/<h1/g) ?? []).length).toBe(1);
        expect(html).toContain('data-statutory-footer="complete"');
        expect(html).toContain('Pre-launch. The name above is a stand-in');
      });

      it('serves the holding page when the marketing routes are withheld', async () => {
        const html = await render(module, WITHHELD);
        /*
         * THE STATE THAT IS EASY TO MISS. While `brandBlockers()` is non-empty every
         * marketing route serves the holding page, and a 404 that went on offering
         * "arrange care" at that moment would be the one advertisement on the
         * deployment — pointing, moreover, at pages that are themselves withheld.
         */
        expect(html).toContain('data-not-published="true"');
        expect(html).toContain('This site is not yet published.');
        // Nothing for § 1812.533(b)(2) to attach to: no name, no service, no link, and
        // no footer either, because there is no advertisement to append one to.
        expect(html).not.toContain('href=');
        expect(html).not.toContain('data-statutory-footer');
        expect(html).not.toContain('referral');
      });

      it('and the holding page is still a document with a landmark and a title', async () => {
        const html = await render(module, WITHHELD);
        /*
         * It was a `<main>` containing one `<p>` — the only page on the site with no
         * `h1` at all, which is a document a screen reader is handed with no title and
         * no outline. An `h1` is not an advertisement: it names no business and offers
         * no service, and the sentence in it is the same sentence.
         */
        expect((html.match(/<h1/g) ?? []).length).toBe(1);
        expect(html).toMatch(/<main id="[^"]+" tabindex="-1"/);
      });

      it('names no cause, in any state', async () => {
        for (const state of [PUBLISHED, WITHHELD, PRELAUNCH]) {
          const html = await render(module, state);
          // Whether a connection string is missing or a query timed out is not a
          // visitor's business. Next logs the real one on the server.
          for (const leak of ['DATABASE_URL', 'postgres', 'PENDING_', 'ECONNREFUSED', 'digest']) {
            expect(html, `${name} leaked "${leak}"`).not.toContain(leak);
          }
        }
      });
    });
  }
});

describe('the error boundary is an error boundary and not a bug report', () => {
  it('never prints what was thrown', async () => {
    const source = code('app/error.tsx');
    /*
     * `error` is in the signature because Next passes it, and nothing here reads it.
     * components/Unavailable.tsx already holds this line for the signed-in screens; this
     * is the same rule on the public side, asserted rather than left to a review.
     */
    expect(source).not.toMatch(/\{\s*error[.\s]/);
    expect(source).not.toContain('error.message');
    expect(source).not.toContain('error.digest');
    const html = await render('@/app/error', PUBLISHED);
    expect(html).not.toContain(THROWN.message);
    expect(html).not.toContain(THROWN.digest);
    // And the table name inside it, in case somebody prints a trimmed version later.
    expect(html).not.toContain('inquiries');
  });

  it('offers the retry first, because a transient failure is the common case', async () => {
    const html = await render('@/app/error', PUBLISHED);
    const retry = html.indexOf('Try the page again');
    const home = html.indexOf('href="/"');
    expect(retry, 'the error page offers no retry').toBeGreaterThan(0);
    expect(retry, 'the retry is not the first thing offered').toBeLessThan(home);
    expect(html).toContain('<button type="button"');
  });
});

describe('the last resort stands on nothing that could have failed', () => {
  const source = code('app/global-error.tsx');

  it('imports no configuration', async () => {
    /*
     * app/error.tsx renders inside the root layout and therefore cannot catch it — and
     * the root layout has a real way to throw at module load: `new URL(siteUrl())`,
     * where a NEXT_PUBLIC_SITE_URL typed without a scheme throws before any page
     * renders. A fallback that imports the thing most likely to have failed is not a
     * fallback, so this page names no business, offers no service and makes no claim:
     * nothing for § 1812.533(b)(2) to attach to, which is also why it needs no footer.
     */
    for (const forbidden of ['@/lib/brand', '@/lib/site', 'process.env', 'DISPLAY_NAME']) {
      expect(source, `app/global-error.tsx imports ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('and the one component it does import reads nothing either', () => {
    // `Main` comes from components/layout.tsx, which is the exception and only because
    // it is inert. If that file ever grows a `lib/` import this page stops being a
    // fallback, quietly, in the state nobody can reproduce.
    expect(source).toContain("from '@/components/layout'");
    const layout = code('components/layout.tsx');
    for (const forbidden of ['@/lib/', 'process.env', 'next/', 'use client']) {
      expect(layout, `components/layout.tsx depends on ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('renders its own document, with a language, a landmark and one h1', async () => {
    const html = await render('@/app/global-error', PUBLISHED);
    // It replaces the root layout outright, so nothing above it supplies these.
    expect(html).toMatch(/^<html lang="en-US">/);
    expect(html).toContain('<body>');
    expect(html).toMatch(/<main id="[^"]+" tabindex="-1">/);
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
  });

  it('is the same page in every brand state, because it reads none of them', async () => {
    const rendered = await Promise.all(
      [PUBLISHED, WITHHELD, PRELAUNCH].map((state) => render('@/app/global-error', state)),
    );
    expect(new Set(rendered).size, 'the last resort varies with configuration').toBe(1);
    for (const html of rendered) {
      // No name and no contact, in any state — there is nothing here to advertise.
      expect(html).not.toContain('Test Registry');
      expect(html).not.toContain('555-0000');
    }
  });

  it('offers a full request for the home page rather than a client navigation', async () => {
    // The app shell is what failed. `next/link` would try to route inside the thing
    // that is broken; a plain anchor asks the server for the one address that cannot be
    // wrong.
    expect(source).not.toContain('next/link');
    expect(await render('@/app/global-error', PUBLISHED)).toContain('<a href="/">');
  });
});

describe('the boundaries are registered where they have to be', () => {
  it('at app/, not inside the route group', () => {
    /*
     * A not-found boundary inside app/(marketing) would render inside that layout —
     * which would give it a footer and a header for free, and would also mean a
     * mistyped URL outside the marketing segment still got the framework's page. These
     * live at app/ and pay for the footer themselves; tests above check they do.
     */
    for (const file of ['app/not-found.tsx', 'app/error.tsx', 'app/global-error.tsx']) {
      expect(() => read(file), `${file} is missing`).not.toThrow();
    }
    expect(code('app/error.tsx').startsWith("'use client'")).toBe(true);
    expect(code('app/global-error.tsx').startsWith("'use client'")).toBe(true);
    // The 404 is a server component: it reads brand state at request time and has no
    // interactivity, and marking it a client component would ship lib/brand to the
    // browser for nothing.
    expect(code('app/not-found.tsx').startsWith("'use client'")).toBe(false);
  });

  it('is never indexed, in any state', () => {
    const source = code('app/not-found.tsx');
    expect(source).toMatch(/robots:\s*\{\s*index:\s*false/);
    /*
     * And the root layout's `canonical: '/'` must not be inherited: a 404 declaring the
     * homepage as its canonical URL invites exactly the collapse `publicMetadata` was
     * written to stop.
     */
    expect(source).toMatch(/alternates:\s*\{\s*canonical:\s*null\s*\}/);
  });
});
