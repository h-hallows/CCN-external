/**
 * Layout primitives. Spec § 6.
 *
 * Four of them, deliberately. A larger set invites a component per page, which is how a
 * site stops looking like one thing.
 *
 * READS NO CONFIGURATION AND CANNOT THROW, which is load-bearing rather than incidental:
 * app/global-error.tsx is the last page the application has left when the root layout
 * itself has failed, and it imports `Main` from here. Keep this module free of
 * `lib/brand`, `lib/site`, `process.env` and anything that touches a database.
 */
import type { ReactNode } from 'react';

/**
 * Where the skip link lands, and the only place this id is written down.
 *
 * A skip link and its landmark are two halves of one mechanism and they were nowhere:
 * there was no skip link on this site, and no `<main>` on it carried an id to aim at.
 * Writing the id in two files is how you get the version that ships — a link to
 * `#main` and a landmark called `#content`, which is a control that is present,
 * correct and never reached, and which nobody notices because the page still scrolls
 * roughly to the right place.
 */
export const MAIN_ID = 'main-content';

/**
 * The first thing in the tab order, on every page that has a header.
 *
 * Styled by `.skip-link` in app/globals.css — off-screen until focused. It must come
 * before the header in the document, because the tab order it is fixing is the document
 * order.
 */
export function SkipLink() {
  return <a className="skip-link" href={`#${MAIN_ID}`}>Skip to the main content</a>;
}

/**
 * The page's main landmark, with the skip link's target on it.
 *
 * `tabIndex={-1}` is not decoration. In WebKit a fragment link to a non-focusable
 * element scrolls the page and leaves focus where it was, so the next Tab walks straight
 * back into the navigation the reader just asked to skip — the skip link appears to work
 * and does nothing. `-1` makes it a focus target without making it a tab stop.
 *
 * A component rather than a convention so that `id` and `tabIndex` cannot be forgotten
 * by the next layout, and so app/not-found.tsx and app/error.tsx — which render inside
 * the ROOT layout and therefore get no `<main>` from the marketing one — have the same
 * one thing to use.
 */
export function Main({ children }: { children: ReactNode }) {
  return <main id={MAIN_ID} tabIndex={-1}>{children}</main>;
}

/**
 * A block that scrolls sideways inside itself, reachable from a keyboard.
 *
 * `.scroller` is how a wide rate table stops the page scrolling sideways, and a `div`
 * with `overflow-x: auto` is not focusable — so the content that only exists off the
 * right-hand edge was unreachable without a mouse or a trackpad (§ 2.1.1). `tabIndex=0`
 * makes it scrollable with the arrow keys, which then needs a role and a name, or the
 * reader is handed a tab stop that announces nothing.
 */
export function Scroller({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="scroller" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

/** Page gutter and maximum width. Everything sits inside one of these. */
export function Wrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `wrap ${className}` : 'wrap'}>{children}</div>;
}

/**
 * Running text. Constrains children to --measure rather than the container, because a
 * 66-character line is readable and a 120-character one is not, whatever the viewport.
 */
export function Prose({ children }: { children: ReactNode }) {
  return <div className="prose">{children}</div>;
}

/** Vertical rhythm between blocks, so pages do not each invent their own spacing. */
export function Stack({ children, gap = 'md' }: { children: ReactNode; gap?: 'sm' | 'md' | 'lg' }) {
  const rem = { sm: '1rem', md: '2rem', lg: '4rem' }[gap];
  return <div style={{ display: 'flex', flexDirection: 'column', gap: rem }}>{children}</div>;
}

/**
 * A titled section. The heading level is explicit so pages keep a sane outline.
 *
 * h1 is allowed because the portal screens are a section that IS the page — their one
 * title is the document's title. A screen reader given a page whose highest heading is
 * an h2 has to guess what it is looking at.
 */
export function Section({
  title, label, children, as: As = 'h2',
}: {
  title?: string;
  label?: string;
  children: ReactNode;
  as?: 'h1' | 'h2' | 'h3';
}) {
  return (
    /*
      * `.section` and not an inline `paddingBlock: '2.5rem'`.
      *
      * ONE HUNDRED AND FORTY-FOUR PIXELS BETWEEN EVERY TWO SECTIONS, measured on the
      * homepage, where the sections themselves run 426 to 611px: a third of a block of
      * content, in blank paper, four times down the page, and the same 144px on a 375px
      * phone where it is most of a screen. 2.5rem above and 2.5rem below is only half of
      * it — `Stack gap="lg"` contributes 4rem of its own between the same two edges, and
      * neither knows about the other.
      *
      * The fix is a clamp in the stylesheet rather than a smaller number here, because
      * the number that is right on a 1440px desktop is not the number that is right on a
      * phone, and an inline style cannot say so. An inline style also cannot be measured
      * by anything, which is how this one sat unexamined through two design passes.
      */
    <section className="section">
      {label ? <p className="label" style={{ margin: '0 0 .35rem' }}>{label}</p> : null}
      {title ? <As>{title}</As> : null}
      {children}
    </section>
  );
}
