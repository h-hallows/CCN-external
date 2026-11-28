/**
 * The public site, as it reaches somebody who cannot see it, cannot use a mouse, or
 * cannot read 14px grey on warm white.
 *
 * WHO THIS IS FOR, because it decides what counts as a defect here. The people reading
 * these pages are mostly adult children arranging care for a parent, often on a phone,
 * often in a hospital corridor, and a material share of them are themselves older.
 * Accessibility on this site is not a compliance decoration bolted to the end of a
 * build; it is the primary audience. A label at 3.9:1 is not a lint finding, it is the
 * enquiry form being unreadable to the person it was written for.
 *
 * WHAT THE AUDIT FOUND, and what each rule below is therefore shaped against:
 *
 *   - --ink-3 measured 3.86:1 on --paper, and `.label` is --ink-3, and `.label` is what
 *     every field's visible label on all three public forms is set in. Every form hint,
 *     every table header and every "reviewed on" line with it.
 *   - There were exactly ZERO `aria-describedby` and ZERO `aria-invalid` attributes in
 *     the whole rendered application. Every hint — including the one asking people to
 *     leave diagnoses off a web form — and every server-side field error was announced
 *     to nobody.
 *   - The form-level error lived in `role="status"` rendered only while there was an
 *     error, so the live region was created in the same commit as the text it existed to
 *     announce. A live region announces changes to a region already being watched; one
 *     that arrives with its content is a region nothing was watching. Present, correct,
 *     green and never reached — this repository's own failure mode, written in ARIA.
 *   - The success panel had the same shape, and focus was not moved to it, so a
 *     submitted enquiry said nothing at all and dropped focus to the top of the page.
 *   - There was no skip link, and no `<main>` carried anything to aim one at.
 *   - app/not-found.tsx and app/error.tsx rendered no `<main>`, so every word on them
 *     was outside every landmark.
 *   - The rate table scrolls sideways inside `.scroller`, which is a `div` and therefore
 *     not focusable: the columns past the right-hand edge were unreachable from a
 *     keyboard.
 *
 * WHY MOST OF IT IS RENDERED AND NOT SCANNED. A source assertion can say that a string
 * is in a file. What matters here is what arrives in the document — whether the id an
 * `aria-describedby` names is actually present, whether the skip link's target exists,
 * whether a page ends up with two `h1`s because a layout and a page each contributed
 * one. So every marketing route is rendered through its real layout and the assertions
 * are made against that HTML. The source-scanning rules below are the ones that must
 * hold for pages nobody has written yet.
 *
 * Rendering a page outside Next means supplying what Next would have: `globalThis.React`
 * for the classic JSX runtime, a `usePathname`, and `settled()` for a page whose default
 * export delegates to an async component.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { seededDb } from '@h-hallows/core/testing';

/* The page's JSX compiles to `React.createElement` here; nothing in the application
 * imports React because Next provides it. Same single line, same reason, as
 * tests/pricingFeeSchedule.test.ts. */
(globalThis as unknown as { React: typeof React }).React = React;

/* `CallToAction` and `EnquiryForm` ask the router which page they are on. Only
 * `usePathname` is replaced: `unstable_rethrow` is real control flow that
 * app/(marketing)/refer/page.tsx depends on, and a stub for it would turn a framework
 * signal into a swallowed log line. */
vi.mock('next/navigation', async (original) => ({
  ...(await original() as object),
  usePathname: () => '/',
}));

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => readFileSync(p, 'utf8');
const rel = (p: string) => `/${p.replace(ROOT, '').replace(/^\//, '')}`;

/** Comments name the forbidden spellings and explain the rules; only code may not. */
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

function filesUnder(dir: string, match: RegExp): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (match.test(name)) out.push(full);
    }
  };
  walk(dir);
  return out;
}

const sourceFiles = [
  ...filesUnder(join(ROOT, 'app'), /\.tsx?$/),
  ...filesUnder(join(ROOT, 'components'), /\.tsx?$/),
];
const css = read(join(ROOT, 'app/globals.css'));
/*
 * The stylesheet with its comments taken out, for the same reason `code()` exists above
 * and the same reason tests/controlFontFloor.test.ts strips them: the comment explaining
 * WHY one selector is allowed to remove an outline contains the words `outline: none`,
 * and the first version of the rule below reported that comment as a violation. A
 * source scan that reads prose is a scan that punishes the explanation.
 */
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

// ---------------------------------------------------------------------------
// Rendering the real documents
// ---------------------------------------------------------------------------

/**
 * A page element with any async component at the root of it already awaited.
 *
 * app/(marketing)/enquire/page.tsx's default export is a one-line delegate to an async
 * `Body`, which stock react-dom/server cannot render — only Next's RSC renderer awaits a
 * nested server component. Unwrapping the chain here is what Next would have done, and
 * it stops at the first component that is not async so a client component is still
 * rendered as a component rather than inlined.
 */
async function settled(node: unknown): Promise<React.ReactElement> {
  let current = node;
  for (let hop = 0; hop < 8; hop += 1) {
    if (!React.isValidElement(current)) break;
    const element = current as React.ReactElement<Record<string, unknown>>;
    if (typeof element.type !== 'function') break;
    const produced = (element.type as (props: unknown) => unknown)(element.props);
    if (!produced || typeof (produced as { then?: unknown }).then !== 'function') break;
    current = await (produced as Promise<unknown>);
  }
  return current as React.ReactElement;
}

interface Route {
  /** The path a visitor types. */
  path: string;
  module: string;
  props?: unknown;
  /** False for the boundary pages, which render inside the ROOT layout instead. */
  throughMarketingLayout?: boolean;
}

/**
 * Every public document, derived by hand rather than from the filesystem on purpose —
 * each one needs its own props, and a route silently dropped from a generated list is
 * exactly the "walk that found nothing" this suite guards against. The guard below
 * asserts the count, so adding a route and forgetting it here fails.
 */
const ROUTES: Route[] = [
  { path: '/', module: '@/app/(marketing)/page' },
  { path: '/how-it-works', module: '@/app/(marketing)/how-it-works/page' },
  { path: '/pricing', module: '@/app/(marketing)/pricing/page' },
  { path: '/vetting', module: '@/app/(marketing)/vetting/page' },
  { path: '/for-providers', module: '@/app/(marketing)/for-providers/page' },
  { path: '/for-partners', module: '@/app/(marketing)/for-partners/page' },
  { path: '/privacy', module: '@/app/(marketing)/privacy/page' },
  {
    path: '/enquire',
    module: '@/app/(marketing)/enquire/page',
    props: { searchParams: Promise.resolve({}) },
  },
  /*
   * The index for the ten curated pages, which is a GET form and a filtered list and so
   * takes the same `searchParams` prop /enquire does. Rendered with none: that is the
   * state a visitor arrives in, and the state in which the picker has to be labelled,
   * focusable and legible.
   */
  {
    path: '/care',
    module: '@/app/(marketing)/care/page',
    props: { searchParams: Promise.resolve({}) },
  },
  { path: '/refer', module: '@/app/(marketing)/refer/page' },
  { path: '/apply', module: '@/app/(marketing)/apply/page' },
  {
    path: '/care/post-surgical-recovery/beverly-hills',
    module: '@/app/(marketing)/care/[service]/[area]/page',
    props: { params: Promise.resolve({ service: 'post-surgical-recovery', area: 'beverly-hills' }) },
  },
  { path: '/not-found', module: '@/app/not-found', throughMarketingLayout: false },
];

/** Route path to the HTML a visitor's browser receives for it. */
const documents = new Map<string, string>();

beforeAll(async () => {
  const db = await seededDb();
  /*
   * A BAND SOMEBODY POSTED, or /pricing renders no table.
   *
   * The seed's own bands are excluded by the query that page runs, so `seededDb()`
   * alone leaves /pricing in its empty state — and the empty state has no `.scroller`
   * in it. The rule below about a scrolling region being reachable from a keyboard then
   * walks zero regions and passes, which is the exact defect this repository is
   * organised against, found by sabotaging that rule and watching nothing happen. The
   * guard in the first describe counts them, so this cannot silently go back to zero.
   */
  await db.query(
    `INSERT INTO rate_ranges
       (service_key, credential_level, low, high, effective_from, posted_at, posted_by)
     VALUES ('respite', 'cna', 31, 37, current_date - 1, now(), 'an operator')`,
  );

  /*
   * /refer reads a session, which means `cookies()`, which throws outside a request.
   * The page catches that and serves the blank form — which is the behaviour under test
   * elsewhere — and logs it. Silenced so a deliberate, handled condition does not print
   * a stack trace in every CI run.
   */
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});

  const { default: MarketingLayout } = await import('@/app/(marketing)/layout');

  for (const route of ROUTES) {
    const { default: Page } = await import(route.module) as {
      default: (props?: unknown) => unknown;
    };
    const body = await settled(Page(route.props));
    const document = route.throughMarketingLayout === false
      ? body
      // The real thing: the layout is what contributes the header, the main landmark,
      // the skip link, the doors and the statutory footer, and half of what is asserted
      // below is about how a page and its layout add up.
      : (MarketingLayout as (p: { children: React.ReactNode }) => React.ReactElement)(
        { children: body },
      );
    documents.set(route.path, renderToStaticMarkup(document));
  }

  quiet.mockRestore();
});

// ---------------------------------------------------------------------------
// A small reader for the rendered HTML
// ---------------------------------------------------------------------------

/**
 * `<[^>]*>` is safe on THIS html and would not be safe on the JSX it came from.
 *
 * tests/controlFontFloor.test.ts has to walk JSX attributes brace-aware, because an
 * arrow function in an attribute contains a `>`. React's server renderer escapes `<`,
 * `>`, `&`, `"` and `'` inside attribute values before they reach the output, so a `>`
 * in rendered html always closes a tag. The `foundEnough` guard is what would catch this
 * assumption being wrong: a scanner that silently matched nothing would make every rule
 * below vacuously true.
 */
interface Element {
  tag: string;
  attrs: Record<string, string>;
  /** Index of the `<` that opens it, for working out what encloses it. */
  at: number;
}

function elements(html: string): Element[] {
  const found: Element[] = [];
  for (const m of html.matchAll(/<([a-zA-Z][\w-]*)((?:\s[^>]*)?)\/?>/g)) {
    const attrs: Record<string, string> = {};
    for (const a of m[2]!.matchAll(/([a-zA-Z-]+)(?:="([^"]*)")?/g)) {
      attrs[a[1]!.toLowerCase()] = a[2] ?? '';
    }
    found.push({ tag: m[1]!.toLowerCase(), attrs, at: m.index });
  }
  return found;
}

/** The character ranges spanned by every `<tag …>…</tag>` of one kind. Labels, fieldsets
 * and `main` do not nest in this application, which is what makes this honest. */
function spansOf(html: string, tag: string): [number, number][] {
  const spans: [number, number][] = [];
  const open = new RegExp(`<${tag}(\\s[^>]*)?>`, 'g');
  for (const m of html.matchAll(open)) {
    const close = html.indexOf(`</${tag}>`, m.index);
    spans.push([m.index, close < 0 ? html.length : close]);
  }
  return spans;
}

const within = (spans: [number, number][], at: number) =>
  spans.some(([from, to]) => at > from && at < to);

const CONTROL = new Set(['input', 'select', 'textarea']);

/*
 * The controls a person can actually meet, which is what every rule below is about.
 *
 * A `type="hidden"` input is in none of those senses a control: it cannot be focused,
 * it renders nothing, it is not in the accessibility tree, and there is no moment at
 * which a reader could be told its name or misled by its placeholder. WCAG's labelling
 * requirement is about user interface components and a hidden input is not one.
 *
 * Written as one helper rather than a filter repeated in each rule, so a rule added
 * later inherits the exclusion instead of rediscovering it. `/enquire`'s `sourcePath`
 * was the first hidden field the site had — added when the three public forms were
 * given a real `action`, because a field the schema requires cannot live only in
 * JavaScript — and it failed this file on the day it appeared.
 *
 * THE HONEYPOT IS NOT EXEMPT, and must not become so. It is a real text input moved
 * off screen with a negative offset, so a screen reader walks straight into it; its
 * label is the only thing that makes it survivable for the reader it is not aimed at.
 */
function realControls(html: string): ReturnType<typeof elements> {
  return elements(html)
    .filter((e) => CONTROL.has(e.tag))
    .filter((e) => e.attrs.type !== 'hidden');
}
/** Focusable without anybody saying so. */
const FOCUSABLE = new Set(['a', 'button', 'input', 'select', 'textarea', 'summary']);

// ---------------------------------------------------------------------------

describe('the walk found the site, so a pass means something', () => {
  it('rendered every public route', () => {
    // Twelve, and the list is written out above: a route added to the application and
    // not to ROUTES fails here rather than quietly going unexamined.
    expect(documents.size).toBe(ROUTES.length);
    const fixed = filesUnder(join(ROOT, 'app/(marketing)'), /^page\.tsx$/).length;
    expect(ROUTES.filter((r) => r.throughMarketingLayout !== false).length).toBe(fixed);
    for (const [path, html] of documents) {
      // The 404 is the shortest document on the site, at about 1.4kB. Anything near
      // zero means the page threw and rendered its empty fallback.
      expect(html.length, `${path} rendered almost nothing`).toBeGreaterThan(1200);
    }
  });

  it('found the form controls, the labels and the landmarks', () => {
    const all = [...documents.values()].flatMap(elements);
    const controls = all.filter((e) => CONTROL.has(e.tag));
    // 67 across the three forms as this is written; all of these are well under.
    expect(controls.length).toBeGreaterThan(50);
    expect(all.filter((e) => e.tag === 'label').length).toBeGreaterThan(50);
    expect(all.filter((e) => e.tag === 'main').length).toBe(documents.size);
    expect(all.filter((e) => e.tag === 'fieldset').length).toBeGreaterThan(5);
    // The rate table. Without a posted band /pricing renders no table and no scrolling
    // region, and the keyboard rule below would pass by examining nothing.
    expect(
      all.filter((e) => (e.attrs.class ?? '').split(/\s+/).includes('scroller')).length,
      'no scrolling region was rendered, so that rule proves nothing',
    ).toBeGreaterThan(0);
  });
});

describe('every page has exactly one h1, and the outline below it does not skip', () => {
  /*
   * ONE, not "at least one". Two is the failure that a layout and a page each
   * contributing a title produces, and it leaves a screen reader with two answers to
   * "what is this page". None is what the holding page had: a document with no title and
   * no outline at all.
   */
  it('exactly one', () => {
    for (const [path, html] of documents) {
      const h1s = elements(html).filter((e) => e.tag === 'h1');
      expect(h1s.length, `${path} renders ${h1s.length} h1 elements`).toBe(1);
    }
  });

  it('no level is skipped on the way down', () => {
    for (const [path, html] of documents) {
      const levels = elements(html)
        .filter((e) => /^h[1-6]$/.test(e.tag))
        .map((e) => Number(e.tag[1]));
      expect(levels[0], `${path} does not open with its h1`).toBe(1);
      for (let i = 1; i < levels.length; i += 1) {
        expect(
          levels[i]! - levels[i - 1]!,
          `${path} jumps from h${levels[i - 1]} to h${levels[i]}`,
        ).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('no control exists without a label a machine can find', () => {
  /*
   * A placeholder is not a label: it disappears the moment somebody types, it is not
   * announced as a name by several engines, and it is grey-on-white by default — all
   * three of which matter most to the reader this site is for. The rule is therefore
   * about the association, and the placeholder check is separate so that "it has a
   * placeholder" can never be mistaken for a pass.
   */
  it('every input, select and textarea is named', () => {
    for (const [path, html] of documents) {
      const labelSpans = spansOf(html, 'label');
      const labelled = new Set(
        elements(html).filter((e) => e.tag === 'label' && e.attrs.for).map((e) => e.attrs.for!),
      );
      for (const control of realControls(html)) {
        const how = control.attrs['aria-label'] ? 'aria-label'
          : control.attrs['aria-labelledby'] ? 'aria-labelledby'
            : control.attrs.id && labelled.has(control.attrs.id) ? 'label[for]'
              : within(labelSpans, control.at) ? 'wrapping label'
                : null;
        expect(
          how,
          `${path}: <${control.tag} name="${control.attrs.name ?? '?'}"> has no label`,
        ).not.toBeNull();
      }
    }
  });

  it('and none of them is leaning on a placeholder instead', () => {
    for (const [path, html] of documents) {
      for (const control of realControls(html)) {
        expect(
          control.attrs.placeholder,
          `${path}: <${control.tag} name="${control.attrs.name}"> uses a placeholder`,
        ).toBeUndefined();
      }
    }
  });
});

describe('what a field says about itself is attached to the field', () => {
  /*
   * The defect: zero `aria-describedby` in the rendered application. The hint under
   * "What is going on" asking people to leave diagnoses and medication off a web form,
   * and the hint under the licence box saying the number is checked against the issuing
   * board, were visible instructions announced to nobody.
   */
  it('every hint and every error is pointed at by its control', async () => {
    const { Field } = await import('@/components/intakeForm');
    const html = renderToStaticMarkup(
      React.createElement(Field, {
        id: 'phone',
        label: 'Your phone',
        hint: 'We call; we do not text.',
        errors: ['That does not look like a telephone number.'],
        children: React.createElement('input', { id: 'phone', name: 'phone' }),
      }),
    );
    const input = elements(html).find((e) => e.tag === 'input')!;
    const described = (input.attrs['aria-describedby'] ?? '').split(/\s+/).filter(Boolean);
    expect(described.length, 'the control describes itself with nothing').toBe(2);
    for (const id of described) {
      expect(html, `aria-describedby names "${id}", which is not in the document`)
        .toContain(`id="${id}"`);
    }
    expect(html).toContain(`id="${described[0]}"`);
    expect(input.attrs['aria-invalid'], 'a refused field does not say it was').toBe('true');
  });

  it('a field that is fine says nothing about being invalid', () => {
    // `aria-invalid="false"` is correct and some older engines read it out loud, which
    // tells a reader about a state the form is not in.
    expect(documents.get('/enquire')).not.toContain('aria-invalid="false"');
  });

  it('the refusal is not told apart from the advice by colour alone', async () => {
    const { Field } = await import('@/components/intakeForm');
    const html = renderToStaticMarkup(
      React.createElement(Field, {
        id: 'phone',
        label: 'Your phone',
        hint: 'We call; we do not text.',
        errors: ['Not a telephone number.'],
        children: React.createElement('input', { id: 'phone' }),
      }),
    );
    /*
     * Before this, the error paragraph and the hint paragraph above it were the same
     * size, the same weight and in the same place, and differed only in being
     * var(--crit) rather than var(--ink-3) — § 1.4.1. The word is what makes the
     * difference survive a reader who does not see the colour.
     */
    expect(html).toMatch(/<p id="phone-error"[^>]*><strong>Error:<\/strong>/);
  });

  it('no component writes a describedby id as a literal it does not also render', () => {
    /*
     * THE HALF THE RENDERED WALK CANNOT SEE, and it was found by sabotaging the rule
     * below rather than by reading the code. The documents rendered in this file are
     * all in their resting state — no form has been submitted, so no server error is on
     * screen — and several `aria-describedby` attributes exist only while there IS an
     * error. Pointing one of those at a name no element has is therefore invisible to a
     * rendered assertion: the attribute is never in the html it inspects.
     *
     * So the error-state ids must be DERIVED rather than typed. `groupErrorId(legend)`
     * is the one the partner form's consent tick uses, and the fieldset it names is
     * rendered from the same call on the same constant, so the two cannot drift. A
     * literal here is the failure this catches — and a literal is allowed where the
     * same file also renders that id, which is the ordinary, checkable case.
     */
    for (const file of sourceFiles) {
      const src = code(file);
      for (const m of src.matchAll(/aria-(?:describedby|labelledby)=(?:"([^"]*)"|\{[^}]*?'([^']*)'|\{[^}]*?"([^"]*)")/g)) {
        const literal = m[1] ?? m[2] ?? m[3];
        if (!literal || literal.includes('$')) continue;
        for (const named of literal.split(/\s+/).filter(Boolean)) {
          expect(
            src.includes(`id="${named}"`) || src.includes(`id='${named}'`),
            `${rel(file)}: aria-describedby="${named}" names an id this file never renders`,
          ).toBe(true);
        }
      }
    }
  });

  it('every id named by an aria attribute exists on the page', () => {
    for (const [path, html] of documents) {
      const ids = new Set(elements(html).map((e) => e.attrs.id).filter(Boolean));
      for (const element of elements(html)) {
        for (const attribute of ['aria-describedby', 'aria-labelledby', 'aria-controls']) {
          const value = element.attrs[attribute];
          if (!value) continue;
          for (const named of value.split(/\s+/).filter(Boolean)) {
            // An aria attribute pointing at nothing is worse than no aria attribute:
            // it reads as handled and announces nothing.
            expect(ids.has(named), `${path}: ${attribute}="${named}" names no element`)
              .toBe(true);
          }
        }
      }
    }
  });
});

describe('a live region that only exists when it has something to say never says it', () => {
  /*
   * THE RULE, and it is the general one rather than the two instances. A live region
   * announces a change to a region the engine was already watching. A region mounted in
   * the same commit as its text is a region nothing was watching, so the announcement
   * never happens — while the attribute, the sentence and any test asserting the
   * sentence all look right. Present, correct, green and never reached.
   */
  it('the form-level message region is in the document before there is a message', async () => {
    const { Submit, IDLE } = await import('@/components/intakeForm');
    const idle = renderToStaticMarkup(
      React.createElement(Submit, { label: 'Send this to us', sendingLabel: 'Sending…', result: IDLE }),
    );
    const region = elements(idle).find((e) => e.attrs.role === 'status');
    expect(region, 'nothing is watching for the form-level message').toBeTruthy();
    expect(region!.attrs['aria-live']).toBe('polite');
    // And it is empty: a region that is already saying something announces nothing new.
    expect(idle).toMatch(/role="status"[^>]*><\/p>|><\/p>/);
  });

  it('and it is the same region once there is one', async () => {
    const { Submit } = await import('@/components/intakeForm');
    const html = renderToStaticMarkup(
      React.createElement(Submit, {
        label: 'Send this to us',
        sendingLabel: 'Sending…',
        result: { state: 'error', message: 'We could not take that just now.', fieldErrors: {} },
      }),
    );
    expect(html).toContain('We could not take that just now.');
    expect(elements(html).filter((e) => e.attrs.role === 'status').length).toBe(1);
  });

  it('the submit button is never disabled out from under the focus on it', async () => {
    const { Submit } = await import('@/components/intakeForm');
    const sending = renderToStaticMarkup(
      React.createElement(Submit, {
        label: 'Send this to us', sendingLabel: 'Sending…', result: { state: 'sending' },
      }),
    );
    const button = elements(sending).find((e) => e.tag === 'button')!;
    // `disabled` on the element that currently holds focus throws focus to the top of
    // the document: a keyboard user pressed Send and lost their place in the form.
    expect(button.attrs).not.toHaveProperty('disabled');
    expect(button.attrs['aria-disabled']).toBe('true');
  });

  it('the confirmation takes focus rather than relying on being announced', async () => {
    const { Confirmation } = await import('@/components/intakeForm');
    const html = renderToStaticMarkup(
      React.createElement(Confirmation, { message: 'We have it.', reference: 'ABC123' }),
    );
    const panel = elements(html)[0]!;
    /*
     * Each form REPLACES its `<form>` with this on success, so the submit button that
     * had focus is unmounted and focus falls to the top of the document. `tabIndex={-1}`
     * plus the focus in its effect is what puts the reader at the top of the news
     * instead, with the reference number ahead of them rather than behind.
     */
    expect(panel.attrs.tabindex, 'the confirmation cannot be focused').toBe('-1');
    const source = code(join(ROOT, 'components/intakeForm.tsx'));
    expect(source, 'nothing moves focus to the confirmation').toMatch(/\.focus\(\)/);
  });
});

describe('the skip link and its landmark are one mechanism', () => {
  it('every page that has a header has a skip link, and it is the first thing in it', () => {
    for (const [path, html] of documents) {
      const focusable = elements(html).filter(
        (e) => (FOCUSABLE.has(e.tag) && e.attrs.href !== undefined) || e.tag === 'button',
      );
      const hasHeader = html.includes('<header');
      if (!hasHeader) {
        // app/not-found.tsx has no navigation, so there is nothing to skip. It still
        // carries the landmark, which the next rule checks.
        expect(html, `${path} has no header but offers a skip link`)
          .not.toContain('class="skip-link"');
        continue;
      }
      expect(focusable[0]?.attrs.class, `${path}: the skip link is not first in the tab order`)
        .toBe('skip-link');
    }
  });

  it('the link lands on the main landmark, and the id is written in one place', () => {
    for (const [path, html] of documents) {
      const main = elements(html).find((e) => e.tag === 'main');
      expect(main, `${path} renders no main landmark`).toBeTruthy();
      expect(main!.attrs.id, `${path}: the main landmark has nothing to aim at`).toBeTruthy();
      /*
       * WebKit scrolls to a fragment without moving focus unless the target can take it,
       * so without this the skip link appears to work and the next Tab goes straight
       * back into the navigation the reader asked to skip.
       */
      expect(main!.attrs.tabindex, `${path}: the main landmark cannot take focus`).toBe('-1');

      const skip = elements(html).find((e) => e.attrs.class === 'skip-link');
      if (!skip) continue;
      expect(skip.attrs.href, `${path}: the skip link aims somewhere else`)
        .toBe(`#${main!.attrs.id}`);
    }
  });

  it('one landmark of each kind per page, and the footer is not inside the main', () => {
    for (const [path, html] of documents) {
      const found = elements(html);
      expect(found.filter((e) => e.tag === 'main').length, `${path} has two mains`).toBe(1);
      /*
       * A `<footer>` that descends from `<main>` is NOT a contentinfo landmark — the
       * mapping only applies to a footer scoped to the document. Wrapping a whole page
       * in `Main` therefore takes the statutory footer out of the landmark list while
       * appearing to add one, which is how the first version of app/not-found.tsx's fix
       * was wrong.
       */
      const mainSpan = spansOf(html, 'main');
      for (const footer of found.filter((e) => e.tag === 'footer')) {
        expect(within(mainSpan, footer.at), `${path}: the footer is inside the main`)
          .toBe(false);
      }
      expect(found.some((e) => e.tag === 'footer'), `${path} has no footer`).toBe(true);
    }
  });

  it('the id and the two components are declared together and nowhere else', () => {
    const layout = code(join(ROOT, 'components/layout.tsx'));
    const id = /export const MAIN_ID = '([^']+)'/.exec(layout);
    expect(id, 'components/layout.tsx declares no MAIN_ID').toBeTruthy();
    expect(layout).toMatch(/href=\{`#\$\{MAIN_ID\}`\}/);
    expect(layout).toMatch(/<main id=\{MAIN_ID\} tabIndex=\{-1\}>/);
    // A second literal copy of the id is a describedby that stops resolving the day
    // somebody renames it, with nothing failing.
    const copies = sourceFiles
      .filter((f) => !f.endsWith('components/layout.tsx'))
      .filter((f) => code(f).includes(`'${id![1]}'`) || code(f).includes(`"${id![1]}"`));
    expect(copies.map(rel), 'the landmark id is written out a second time').toEqual([]);
  });

  it('leaves no main unwired to it, anywhere in the application', () => {
    /*
     * This was a list. The three portal layouts each rendered
     * `<main><Wrap>{children}</Wrap></main>` with no id and no tabIndex and no skip
     * link, and they were named here rather than exempted silently — which is how an
     * exemption becomes permanent — with the note that fixing one was a line to delete.
     * All three are wired now, so the list is empty and the rule is the plain one: a
     * `<main>` that is not the shared landmark is a regression, wherever it appears.
     *
     * `app/login` was on that list too and is not a `<main>` case at all: it renders
     * inside the root layout like the boundary pages, and it now uses `Main` as they do.
     */
    const outstanding = sourceFiles
      .filter((file) => {
        /*
         * THE ATTRIBUTES OF THE `<main>`, not the file. Asking whether the file
         * mentions MAIN_ID anywhere passes on the strength of the import line alone —
         * found by sabotaging components/NotPublished.tsx's landmark and watching this
         * stay green. And the attribute text is read brace-aware rather than up to the
         * next `>`, for the reason tests/controlFontFloor.test.ts gives: an arrow
         * function in a JSX attribute contains a `>`.
         */
        const src = code(file);
        return [...src.matchAll(/<main\b/g)].some((m) => {
          let depth = 0;
          let end = src.length;
          for (let i = m.index + m[0].length; i < src.length; i += 1) {
            const ch = src[i];
            if (ch === '{') depth += 1;
            else if (ch === '}') depth -= 1;
            else if (ch === '>' && depth === 0) { end = i; break; }
          }
          return !src.slice(m.index, end).includes('MAIN_ID');
        });
      })
      .map(rel)
      .sort();
    expect(
      outstanding,
      `${outstanding.join(', ')} renders a <main> that is not the shared landmark, so `
      + 'the skip link cannot reach it and focus cannot be moved into it.',
    ).toEqual([]);
  });
});

describe('nothing focusable is hidden from the people who need it most', () => {
  it('no aria-hidden subtree contains anything that can be tabbed to', () => {
    for (const [path, html] of documents) {
      const hidden = elements(html).filter((e) => e.attrs['aria-hidden'] === 'true');
      for (const container of hidden) {
        const close = html.indexOf(`</${container.tag}>`, container.at);
        const subtree = html.slice(container.at, close < 0 ? html.length : close);
        for (const inside of elements(subtree)) {
          const naturally = FOCUSABLE.has(inside.tag)
            && (inside.tag !== 'a' || inside.attrs.href !== undefined);
          const tabbable = inside.attrs.tabindex !== undefined
            ? Number(inside.attrs.tabindex) >= 0
            : naturally;
          /*
           * The honeypot is the live case: a label and an input positioned off-screen
           * for bots, inside `aria-hidden`. It passes because the input carries
           * `tabIndex={-1}`, so it is out of the tab order as well as out of the tree —
           * a reader cannot be put inside something their software has been told is not
           * there. Drop the tabIndex and this is a keyboard trap in a box that announces
           * nothing.
           */
          expect(tabbable, `${path}: <${inside.tag}> is tabbable inside aria-hidden`)
            .toBe(false);
        }
      }
    }
  });

  it('a region that scrolls can be scrolled from a keyboard, and says what it is', () => {
    for (const [path, html] of documents) {
      for (const scroller of elements(html).filter((e) => (e.attrs.class ?? '').split(/\s+/).includes('scroller'))) {
        // A div with overflow-x:auto is not focusable, so whatever is past the right
        // edge — four credential columns of rates, at 320px — is mouse-only.
        expect(scroller.attrs.tabindex, `${path}: a .scroller is not reachable`).toBe('0');
        expect(scroller.attrs.role, `${path}: a focusable .scroller has no role`).toBe('region');
        expect(scroller.attrs['aria-label'], `${path}: a .scroller announces nothing`)
          .toBeTruthy();
      }
    }
  });

  it('only one component writes that class, so the rule reaches pages nobody renders', () => {
    /*
     * THE RULE ABOVE IS BLIND TO THE AUTHENTICATED HALF. It walks rendered documents,
     * and the documents in this file are the marketing routes plus the 404 — a portal
     * page needs a session and a database to render at all. Five scrolling regions in
     * the portals were therefore keyboard-unreachable while that rule was green:
     * `/pro/availability`, `/pro/fee-schedule`, `/pro/credentials` twice and
     * `/portal/schedule` — every one of them a week-by-shift or document table wider
     * than a phone, in the half of the site a nurse and a family actually use.
     *
     * So the class is spelled in exactly one place. `Scroller` in components/layout.tsx
     * applies the tabIndex, the role and the name together, and nothing else may write
     * `className="scroller"` — which is a rule a page nobody has written yet inherits,
     * where the rendered walk can only speak for the pages it can build.
     */
    const writers = sourceFiles
      .filter((file) => /className=(?:"|')[^"']*\bscroller\b/.test(code(file)))
      .map(rel)
      .sort();
    expect(
      writers,
      `${writers.join(', ')} writes className="scroller" directly. Use <Scroller label>; `
      + 'a bare div with overflow-x cannot take focus, so whatever is past the right '
      + 'edge is mouse-only.',
    ).toEqual(['/components/layout.tsx']);
  });

  it('every link says where it goes without its surroundings', () => {
    for (const [path, html] of documents) {
      for (const [from, to] of spansOf(html, 'a')) {
        const inner = html.slice(html.indexOf('>', from) + 1, to);
        const words = inner.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').trim();
        const anchor = elements(html).find((e) => e.at === from)!;
        const name = anchor.attrs['aria-label'] ?? words;
        expect(name.length, `${path}: a link with href="${anchor.attrs.href}" has no text`)
          .toBeGreaterThan(0);
        for (const useless of ['click here', 'read more', 'here', 'more', 'link']) {
          expect(name.toLowerCase(), `${path}: a link reads "${name}"`).not.toBe(useless);
        }
      }
    }
  });

  it('the document says what language it is in', () => {
    // On the root layout, so it covers the portals and the boundary pages too; and on
    // app/global-error.tsx separately, which replaces the root layout outright.
    for (const file of ['app/layout.tsx', 'app/global-error.tsx']) {
      expect(code(join(ROOT, file)), `${file} declares no lang`).toMatch(/<html lang="en-US">/);
    }
  });
});

describe('focus is visible, and nothing anywhere takes it away', () => {
  /*
   * THE ALLOWED EXCEPTION, and it is the only one. `main[tabindex='-1']` is the skip
   * link's landing place: it is not focusable except programmatically, and a 3px ring
   * drawn around a region the height of the page is noise rather than information. Every
   * other selector that removes an outline is a keyboard user losing their place, and
   * the rule is stated as "this selector and no other" so that the next `outline: none`
   * somebody adds has to come past this test.
   */
  const ALLOWED = "main[tabindex='-1']:focus";

  it('a ring is declared for everything that can be focused', () => {
    const ring = /:focus-visible\s*\{([^}]*)\}/.exec(css);
    expect(ring, 'app/globals.css declares no focus indicator').toBeTruthy();
    expect(ring![1], 'the focus indicator has no outline').toMatch(/outline:\s*\d+px/);
    const width = /outline:\s*(\d+)px/.exec(ring![1]!);
    expect(Number(width![1]), 'a 1px ring is what the engine would have drawn anyway')
      .toBeGreaterThanOrEqual(2);
    // Offset, so the ring is never drawn against a filled button's own colour — the
    // primary door is oxblood and the primary card is --accent-soft.
    expect(ring![1]).toMatch(/outline-offset:\s*\d+px/);
  });

  it('no stylesheet rule removes an outline, bar the one landmark', () => {
    for (const m of cssCode.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (!/outline(-style)?:\s*(none|0)\b/.test(m[2]!)) continue;
      expect(m[1]!.trim(), 'a rule removes the focus ring').toBe(ALLOWED);
    }
  });

  it('and no component removes one inline either', () => {
    for (const file of sourceFiles) {
      const src = code(file);
      for (const banned of [/outline:\s*['"]?none/, /outline:\s*0\b/, /outlineStyle:\s*['"]none/]) {
        expect(banned.test(src), `${rel(file)} removes a focus outline`).toBe(false);
      }
    }
  });

  it('the skip link is off-screen rather than display:none, or it could not be focused', () => {
    const rule = /\.skip-link\s*\{([^}]*)\}/.exec(css);
    expect(rule, 'no .skip-link rule').toBeTruthy();
    expect(rule![1]).not.toMatch(/display:\s*none/);
    expect(rule![1]).not.toMatch(/visibility:\s*hidden/);
    expect(rule![1], 'the skip link is not hidden until it is wanted').toMatch(/transform:\s*translateY/);
    expect(css, 'the skip link never comes back').toMatch(/\.skip-link:focus\s*\{[^}]*translateY\(0\)/);
  });
});

describe('every colour this site sets text in is legible on what it sits on', () => {
  /** WCAG relative luminance. */
  function luminance(hex: string): number {
    const parts = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const linear = parts.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  }
  function ratio(a: string, b: string): number {
    const [x, y] = [luminance(a), luminance(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  /** The tokens declared in one `{ … }` block of the stylesheet. */
  function tokens(selector: string): Record<string, string> {
    const at = cssCode.indexOf(selector);
    expect(at, `app/globals.css has no ${selector} block`).toBeGreaterThanOrEqual(0);
    const open = cssCode.indexOf('{', at);
    const block = cssCode.slice(open, cssCode.indexOf('}', open));
    const out: Record<string, string> = {};
    for (const m of block.matchAll(/(--[\w-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) out[m[1]!] = m[2]!;
    return out;
  }

  const BACKGROUNDS = ['--paper', '--surface', '--surface-2'];
  /** Everything the stylesheet or a component ever sets `color` to. */
  const TEXT = ['--ink', '--ink-2', '--ink-3', '--accent', '--accent-2', '--crit', '--ok', '--warn'];

  const themes: [string, string[]][] = [
    [':root', TEXT],
    // The portal block does not redeclare --crit, --ok or --warn, and the rule below
    // asserts that no screen under a portal route group uses one.
    ["[data-surface='portal']", ['--ink', '--ink-2', '--ink-3', '--accent', '--accent-2']],
  ];

  for (const [selector, inks] of themes) {
    it(`clears 4.5:1 for body text in ${selector}`, () => {
      const t = tokens(selector);
      // The walk finding an empty block would make every expectation below vacuous.
      expect(Object.keys(t).length, `${selector} declared no colours`).toBeGreaterThan(8);
      for (const ink of inks) {
        for (const background of BACKGROUNDS) {
          const value = t[ink] ?? tokens(':root')[ink]!;
          const behind = t[background] ?? tokens(':root')[background]!;
          const measured = ratio(value, behind);
          expect(
            Number(measured.toFixed(2)),
            `${selector} ${ink} (${value}) on ${background} (${behind})`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }

  it('and on the one card that has a colour of its own', () => {
    // `.cta-card.is-primary` is --accent-soft, and carries a `.label` and a `.cta-go`,
    // both of which are --ink-3. It is the single background outside the three above.
    const t = tokens(':root');
    for (const ink of ['--ink', '--ink-2', '--ink-3', '--accent']) {
      expect(
        Number(ratio(t[ink]!, t['--accent-soft']!).toFixed(2)),
        `${ink} on --accent-soft`,
      ).toBeGreaterThanOrEqual(4.5);
    }
    // And the primary button, which is text on --accent rather than the other way round.
    expect(Number(ratio(t['--paper']!, t['--accent']!).toFixed(2))).toBeGreaterThanOrEqual(4.5);
  });

  it('the edge of a control clears 3:1, which is a different rule from the one above', () => {
    /*
     * § 1.4.11. A field here is a white box on warm white paper, so the border is the
     * only thing saying there is a box at all; it was --line-2, which measures 1.78:1 on
     * --surface. --line and --line-2 still rule off cards and table rows, where no
     * minimum applies, and that is why this is a third token rather than a change to
     * those two.
     */
    for (const selector of [':root', "[data-surface='portal']"]) {
      const t = tokens(selector);
      expect(t['--control-border'], `${selector} declares no --control-border`).toBeTruthy();
      for (const background of [...BACKGROUNDS]) {
        expect(
          Number(ratio(t['--control-border']!, t[background]!).toFixed(2)),
          `${selector} --control-border on ${background}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('a control takes its border from that token and not from the hairline one', () => {
    const save = code(join(ROOT, 'components/SaveForm.tsx'));
    expect(save, 'fieldStyle is back on the hairline').toMatch(
      /fieldStyle[\s\S]*?border:\s*'1px solid var\(--control-border\)'/,
    );
    expect(css).toMatch(/\.btn\s*\{[^}]*border:\s*1px solid var\(--control-border\)/);
  });

  it('nothing under a portal route group uses a colour the portal does not redeclare', () => {
    // --crit, --ok and --warn are light-theme values. The dark block leaves them alone,
    // which is correct only for as long as nothing dark renders them.
    const portalFiles = sourceFiles.filter((f) => /\/app\/\((client|provider|partner)\)\//.test(f));
    expect(portalFiles.length, 'found no portal screens, so this proves nothing')
      .toBeGreaterThan(10);
    for (const file of portalFiles) {
      for (const token of ['--crit', '--ok', '--warn']) {
        expect(code(file).includes(`var(${token})`), `${rel(file)} uses ${token} on a dark surface`)
          .toBe(false);
      }
    }
  });
});
