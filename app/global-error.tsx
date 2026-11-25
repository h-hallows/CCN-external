'use client';

import './globals.css';

/**
 * The last resort: what is served when the ROOT layout itself throws.
 *
 * WHY THIS IS NEEDED AND NOT BELT-AND-BRACES. app/error.tsx renders inside the root
 * layout, so it cannot catch the root layout. And the root layout has a real way to
 * throw at module load: `metadataBase: new URL(siteUrl())`, where a
 * NEXT_PUBLIC_SITE_URL somebody typed without a scheme makes `new URL` throw before any
 * page renders. A misconfiguration that takes the whole deployment to the framework's
 * default error page is precisely the dead end this work is about.
 *
 * IT IMPORTS NO CONFIGURATION, DELIBERATELY. Everything else here reads lib/brand and
 * lib/site to decide what it may say — but the thing that has most likely failed to get
 * us here is that configuration being read in the root layout, and a fallback that
 * depends on the broken thing is not a fallback. So this page names no business, offers
 * no service and makes no claim: nothing for § 1812.533(b)(2) to attach to, which is
 * the same posture components/NotPublished.tsx takes and the reason it needs no
 * statutory footer.
 *
 * It renders its own `html` and `body` because it replaces the root layout rather than
 * rendering inside it, and the stylesheet is imported for the same reason — without it
 * this is the bare page the defect was about.
 */
export default function GlobalError({ reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-US">
      <body>
        <div className="wrap" style={{ maxWidth: '34rem', paddingBlock: '5rem' }}>
          <h1 style={{ fontSize: 'var(--step-2)' }}>This did not load</h1>
          <p style={{ color: 'var(--ink-2)' }}>
            Something stopped before the page could be built. Trying again sometimes
            clears it.
          </p>
          <p>
            <button type="button" onClick={reset} className="btn btn-primary">
              Try again
            </button>
          </p>
          {/*
            * A plain anchor, not next/link. The app shell is what failed; a full
            * request for the home page is the thing most likely to work, and it is the
            * one address that cannot be wrong.
            */}
          <p>
            <a href="/">Back to the beginning</a>
          </p>
        </div>
      </body>
    </html>
  );
}
