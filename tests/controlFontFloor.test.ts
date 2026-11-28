/**
 * No form control on this site zooms Mobile Safari, and the next one added will not
 * either.
 *
 * THE DEFECT THIS FILE IS ABOUT. Safari zooms the viewport whenever a focused `input`,
 * `select` or `textarea` computes below 16px, and it does not zoom back out when the
 * field is left. `--step--1` tops out at about 14px, and the shared field style every
 * public form and every provider screen uses was set to it — so tapping the first box
 * of the enquiry form, which is the door the business runs on, jerked the layout and
 * left the visitor zoomed in, mid-form.
 *
 * WHY IT IS A RULE AND NOT FIVE FIXES. The fields were fixed by removing the font size
 * from four style objects, which is true until somebody writes a sixth form. So the
 * floor is stated once, in app/globals.css, where a control that says nothing about its
 * size inherits it — and this file asserts both halves of that: that the rule is in the
 * stylesheet in a form an inline style cannot undercut, and that nothing in the source
 * declares a size on a control that would try.
 *
 * AND NOT BY FORBIDDING ZOOM. The other way to stop Safari zooming is
 * `maximum-scale=1` or `user-scalable=no` in the viewport meta, which "fixes" it by
 * taking pinch-zoom away from everybody who needs it — including the clientele this
 * site is written for, who are mostly reading it about a parent. That is a worse defect
 * than the one it answers, so it is asserted absent rather than left to a review.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => readFileSync(p, 'utf8');

/** Comments explain the rule and name the forbidden spellings; only code may not. */
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
  ...filesUnder(join(ROOT, 'lib'), /\.tsx?$/),
];

const css = read(join(ROOT, 'app/globals.css'));

/** px, for a length written in px or in rem against a 16px root. */
function lengthPx(value: string): number | null {
  const px = /^([\d.]+)px$/.exec(value.trim());
  if (px) return Number(px[1]);
  const rem = /^([\d.]+)rem$/.exec(value.trim());
  if (rem) return Number(rem[1]) * 16;
  return null;
}

/** The balanced `{ … }` that starts at or after `from`. */
function blockAt(src: string, from: number): string {
  const open = src.indexOf('{', from);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return src.slice(open);
}

/**
 * A control element's attribute text.
 *
 * Brace-aware rather than "everything up to the next `>`", because an arrow function in
 * an attribute — `onChange={(e) => setType(e.target.value)}`, which is on the one select
 * in the provider application form — contains a `>`. Stopping there cut the element off
 * before its `style`, so the naive version of this walk reported that select as having
 * no style at all. A walk that quietly looks at less than it claims to is the failure
 * this file exists to catch, so it cannot be the way this file looks.
 */
function attributesAt(src: string, from: number): string {
  let depth = 0;
  for (let i = from; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (ch === '>' && depth === 0) return src.slice(from, i);
  }
  return src.slice(from);
}

interface Control {
  file: string;
  tag: string;
  /** The inline style object literal, if the element has one. */
  inline: string | null;
  /** The identifier the style came from, if it is shared. */
  named: string | null;
}

/** Every text-entry control in the application, with where its style comes from. */
function controls(): Control[] {
  const found: Control[] = [];
  for (const file of sourceFiles) {
    const src = code(file);
    for (const m of src.matchAll(/<(input|select|textarea)\b/g)) {
      const attrs = attributesAt(src, m.index + m[0].length);
      const at = attrs.indexOf('style=');
      let inline: string | null = null;
      let named: string | null = null;
      if (at >= 0) {
        const expression = blockAt(attrs, at).slice(1, -1).trim();
        if (expression.startsWith('{')) inline = expression;
        else named = /^([A-Za-z_$][\w$]*)/.exec(expression)?.[1] ?? null;
      }
      found.push({ file, tag: m[1]!, inline, named });
    }
  }
  return found;
}

/**
 * A named style's definition, and anything it is built out of.
 *
 * `inputStyle(errors)` spreads `fieldStyle`, so following one name is not enough: the
 * size would be reachable one hop away and this would report the chain clean.
 */
function styleSources(name: string, seen = new Set<string>()): { name: string; body: string }[] {
  if (seen.has(name)) return [];
  seen.add(name);
  const out: { name: string; body: string }[] = [];
  for (const file of sourceFiles) {
    const src = code(file);
    const definition = new RegExp(`(?:const|let|function)\\s+${name}\\b`).exec(src);
    if (!definition) continue;
    const body = blockAt(src, definition.index);
    if (!body) continue;
    out.push({ name, body });
    for (const ref of body.matchAll(/\b([A-Za-z_$][\w$]*Style)\b/g)) {
      if (ref[1] !== name) out.push(...styleSources(ref[1]!, seen));
    }
  }
  return out;
}

describe('the 16px floor is in the stylesheet, where a new form inherits it', () => {
  it('declares a floor of at least 16px', () => {
    const declared = /--control-font-min:\s*([^;]+);/.exec(css);
    expect(declared, 'app/globals.css declares no --control-font-min').toBeTruthy();
    const px = lengthPx(declared![1]!);
    expect(px, `--control-font-min is ${declared![1]}`).not.toBeNull();
    // Below this, Safari zooms on focus and does not zoom back.
    expect(px!).toBeGreaterThanOrEqual(16);
  });

  it('applies it to every text-entry control, including ones nobody has written yet', () => {
    /*
     * EVERY rule whose selector names the controls, not whichever one comes first.
     *
     * `exec` returns the earliest match in the file, so the moment a second rule was
     * written with this same selector list — the motion section does exactly that,
     * higher up — this test started reading that rule's body, finding no font-size in
     * it, and failing while the floor it was actually asking about sat intact a
     * hundred lines below. The failure message pointed at the floor, which was fine.
     *
     * A test that finds a rule by its selector has to assume the selector gets written
     * more than once, because a stylesheet is allowed to do that. Collect them all and
     * ask whether any of them carries the declaration — which is what the `.btn`
     * assertion further down has always done.
     */
    const candidates = [...css.matchAll(new RegExp(
      String.raw`input:not\(\[type='checkbox'\]\):not\(\[type='radio'\]\)`
      + String.raw`[^{]*\{([^}]*)\}`,
      'g',
    ))];
    expect(
      candidates.length,
      'no rule in app/globals.css floors input, select and textarea',
    ).toBeGreaterThan(0);
    const rule = candidates.find(
      (m) => /font-size:\s*max\(\s*var\(--control-font-min\)/.test(m[1]!),
    );
    expect(
      rule,
      'a rule names the controls but none of them declares the 16px floor',
    ).toBeTruthy();
    const selector = css.slice(css.lastIndexOf('}', rule!.index) + 1, rule!.index + rule![0].indexOf('{'));
    for (const tag of ['select', 'textarea']) {
      expect(selector, `the floor does not cover ${tag}`).toContain(tag);
    }
    expect(rule![1]).toMatch(/font-size:\s*max\(\s*var\(--control-font-min\)/);
  });

  it('floors it in a form an inline style cannot undercut', () => {
    /*
     * The one !important on the site, and the reason is not style. Every field here is
     * styled with an inline style object and an inline style beats a stylesheet, so the
     * rule without it is present, correct, green and never reached — including on
     * app/login, whose input declares `font: inherit` and would go on taking its size
     * from whatever it happens to sit inside.
     */
    const floor = /font-size:\s*max\(\s*var\(--control-font-min\)[^;]*;/.exec(css);
    expect(floor, 'the floor is not declared with max(var(--control-font-min), …)').toBeTruthy();
    expect(floor![0], 'the floor can be overridden by an inline style').toContain('!important');
  });

  it('asks for a size that is itself never below the floor', () => {
    // --control-font is what a control may ask for; the floor only raises it. If the
    // token it points at could compute under 16px on a narrow screen, every control
    // would sit exactly at the floor and the scale would be a decoration.
    expect(css).toMatch(/--control-font:\s*var\(--step-0\)/);
    const step0 = /--step-0:\s*clamp\(\s*([^,]+),/.exec(css);
    expect(step0, 'no --step-0 clamp to read').toBeTruthy();
    expect(lengthPx(step0![1]!)!).toBeGreaterThanOrEqual(16);
  });
});

describe('nothing in the source declares a size on a control', () => {
  const all = controls();

  it('finds the controls, so a passing walk means something', () => {
    // The walk silently finding nothing is how this file would pass while the site
    // zoomed. Both numbers are well under what is there now.
    expect(all.length).toBeGreaterThan(40);
    expect(new Set(all.map((c) => c.file)).size).toBeGreaterThan(8);
    expect(all.some((c) => c.named === 'fieldStyle')).toBe(true);
  });

  it('no control carries an inline font size', () => {
    for (const c of all) {
      if (!c.inline) continue;
      expect(
        /fontSize/.test(c.inline),
        `a <${c.tag}> in ${c.file.replace(ROOT, '')} sets its own fontSize`,
      ).toBe(false);
    }
  });

  it('no shared field style carries one either, however many hops away', () => {
    const names = [...new Set(all.map((c) => c.named).filter((n): n is string => Boolean(n)))];
    expect(names.length, 'no control uses a shared style, which cannot be right').toBeGreaterThan(0);
    const sources = names.flatMap((n) => styleSources(n));
    expect(sources.length, `could not resolve ${names.join(', ')}`).toBeGreaterThan(0);
    for (const { name, body } of sources) {
      expect(/fontSize/.test(body), `${name} sets a fontSize for the controls using it`).toBe(false);
    }
  });

  it('declares a floor on the box, not just on the text', () => {
    /*
     * THIS USED TO BE ARITHMETIC, AND THE ARITHMETIC WAS RIGHT ABOUT ONE CONTROL.
     *
     * It read `fieldStyle`'s vertical padding and line height, computed
     * `2 * padding + 16 * lineHeight + 2` — 48 — and asserted that against 44, with a
     * comment saying it was there so trimming the padding later could not take the
     * target back under. As a guard on that padding it worked. As a statement about
     * whether a field can be hit with a thumb it was wrong, and measuring the live site
     * on a phone is what showed it: at 375px the selects came out at 43.8px and every
     * `.btn` at 42.3px. A select's box model is not an input's, and a button is a
     * different style object that sum never looked at — one number, derived from one
     * object, claimed for every control on the site.
     *
     * So the floor is declared in the stylesheet, where a control inherits it, and this
     * asserts the declaration rather than recomputing it. Same shape as the font floor
     * directly above: state the rule once, in the place that enforces it.
     */
    const declared = /--control-min-target:\s*([^;]+);/.exec(css);
    expect(declared, 'app/globals.css declares no --control-min-target').toBeTruthy();
    const px = lengthPx(declared![1]!);
    expect(px, `--control-min-target is ${declared![1]}`).not.toBeNull();
    expect(
      px!,
      `--control-min-target is ${declared![1]!.trim()}. Below 44px a target cannot be `
      + 'aimed at reliably, and the people this site is written for are often holding '
      + 'the phone in one hand in a hospital corridor.',
    ).toBeGreaterThanOrEqual(44);

    // On the text-entry controls, in the same rule as the font floor...
    // Every rule that names the controls, for the reason given above.
    const controlRules = [...css.matchAll(
      /input:not\(\[type='checkbox'\]\):not\(\[type='radio'\]\)[^{]*\{([^}]*)\}/g,
    )].map((m) => m[1]!);
    expect(
      controlRules.length,
      'no rule in app/globals.css floors the controls',
    ).toBeGreaterThan(0);
    expect(
      controlRules.some((b) => /min-height:\s*var\(--control-min-target\)/.test(b)),
      'no rule declares a min-height on the controls, so a select is whatever its '
      + 'engine makes it — which on a phone was 43.8px',
    ).toBe(true);

    // ...and on the buttons, which are not text-entry controls and were never covered.
    const btn = /\.btn\s*\{([^}]*)\}/g;
    const blocks = [...css.matchAll(btn)].map((m) => m[1]!);
    expect(blocks.length, 'no .btn rule to read').toBeGreaterThan(0);
    expect(
      blocks.some((b) => /min-height:\s*var\(--control-min-target\)/.test(b)),
      '.btn has no min-height, and a button is the thing on the page most likely to be '
      + 'tapped — the live site served every one of them at 42.3px',
    ).toBe(true);
  });
});

describe('the fix is never to forbid zooming', () => {
  it('no viewport anywhere disables pinch-zoom', () => {
    for (const file of sourceFiles) {
      const src = code(file);
      for (const banned of ['maximumScale', 'userScalable', 'maximum-scale', 'user-scalable']) {
        expect(src, `${file.replace(ROOT, '')} sets ${banned}`).not.toContain(banned);
      }
    }
  });

  it('the root layout sets the viewport, and sets only what it should', () => {
    const layout = code(join(ROOT, 'app/layout.tsx'));
    const viewport = /export const viewport[^=]*=\s*([^;]+);/.exec(layout);
    expect(viewport, 'app/layout.tsx exports no viewport').toBeTruthy();
    expect(viewport![1]).toContain("width: 'device-width'");
    expect(viewport![1]).toMatch(/initialScale:\s*1\b/);
  });
});
