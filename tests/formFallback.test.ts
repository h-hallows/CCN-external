/**
 * What the three public forms do when JavaScript does not run.
 *
 * WHAT WAS WRONG, AND IT WAS NOT SMALL. `/enquire`, `/apply` and `/refer` were each
 * `<form onSubmit={...}>` with no `action` and no `method`. A form with neither does a
 * GET to the current URL carrying every named field in the query string — so with
 * JavaScript off, with a bundle that failed to load, or simply inside the hydration
 * window on a hotel connection, pressing "Send this to us" produced
 *
 *   /enquire?...&name=Jane+Doe&phone=310-555-0123&email=jane%40example.com
 *            &message=Mum+is+discharging+Monday+after+a+hip+replacement
 *
 * which was measured in a browser, not reasoned about. A household's name, telephone,
 * email and free-text description of what is wrong with their mother, written into the
 * URL bar, the session history, the access log of every proxy between them and us, and
 * the referrer header of whatever they clicked next. On `/refer` the same press carried
 * a patient's initials and the referring clinician's direct line. The visitor was then
 * shown an empty form with no error, so nobody — them or us — knew it had not arrived.
 *
 * Every other form in this repository was already correct: the portal screens and
 * `app/login` all use `<form action={serverAction}>`. These three were the exception,
 * and they are the three that strangers use.
 *
 * WHY THESE RULES AND NOT A TEST OF THE THREE FILES. Naming the three files is a test
 * that passes forever and protects nothing the day a fourth door is built. Both rules
 * below are stated over whatever forms exist.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { globSync } from 'node:fs';

const ROOT = join(__dirname, '..');

const sources = globSync('{app,components}/**/*.tsx', { cwd: ROOT })
  .filter((f) => !f.includes('node_modules'))
  .sort();

const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/*
 * COMMENTS STRIPPED BEFORE ANYTHING IS MATCHED, because the first draft of this file
 * failed on EnquiryForm.tsx — whose new docblock quotes the broken markup it replaced,
 * `<form onSubmit={...}>`, as the explanation of what went wrong. The rule read the
 * explanation as a fourth form and reported the bug as still present. A test that
 * greps source has to read code and not prose, or the clearest comment in the file is
 * the one most likely to break it.
 */
const code = (rel: string) => read(rel)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Each `<form ...>` opening tag in a file, with the file it came from. */
function formTags(): { file: string; tag: string }[] {
  const out: { file: string; tag: string }[] = [];
  for (const file of sources) {
    const src = code(file);
    for (const match of src.matchAll(/<form\b[\s\S]*?>/g)) {
      out.push({ file, tag: match[0]! });
    }
  }
  return out;
}

describe('a form submits somewhere, whether or not JavaScript is running', () => {
  it('finds the forms at all, so this file cannot pass by matching nothing', () => {
    expect(formTags().length).toBeGreaterThanOrEqual(6);
  });

  it('every form declares an action', () => {
    for (const { file, tag } of formTags()) {
      expect(
        /\saction=/.test(tag),
        `${file} has a <form> with no action. A form with no action submits to the `
        + 'current URL, and a form with no method submits by GET — which puts every '
        + 'named field, including a telephone number and whatever somebody typed about '
        + 'their mother, into the URL bar and the access log.',
      ).toBe(true);
    }
  });

  it('a form whose press is handled in JavaScript also declares method="post"', () => {
    /*
     * `action={serverAction}` needs no method: Next serialises the action into the
     * element and the browser's own submit is a POST. A form that keeps an `onSubmit`
     * handler and a string action is the case that has to say so out loud, because the
     * default is GET and GET is the leak.
     */
    for (const { file, tag } of formTags()) {
      if (!/onSubmit=/.test(tag)) continue;
      expect(
        /method="post"/.test(tag),
        `${file} handles its submit in JavaScript but declares no method, so the `
        + 'browser\'s own submit is a GET and every field lands in the query string.',
      ).toBe(true);
    }
  });
});

describe('no field the server requires exists only in JavaScript', () => {
  /*
   * THE SECOND HALF OF THE SAME BUG, AND THE ONE THAT ONLY APPEARED ONCE THE FIRST WAS
   * FIXED. `EnquiryForm` added `sourcePath` to the request body inside `postIntake`'s
   * shape callback. The schema marks that field `// hidden` and does not make it
   * optional, so the moment the form had a real action the browser's own POST was
   * refused outright — `{"ok":false,"fieldErrors":{"sourcePath":["Required"]}}` — for
   * a field the person filling the form had never heard of and could not supply.
   *
   * So: anything a shape callback puts in the body has to be a real field in the same
   * form. The remaining callbacks are allowed, because they only change the SHAPE of a
   * value the markup already posts — `getAll` for the repeated checkboxes, a boolean
   * for the consent tick — and `lib/intakeResponse.ts` now performs both of those
   * conversions on the server for the path where no callback runs.
   */
  const intakeForms = sources.filter((f) => /postIntake\(/.test(code(f)));

  it('finds the forms that post intake, so this cannot pass by matching nothing', () => {
    expect(intakeForms.length).toBeGreaterThanOrEqual(3);
  });

  for (const file of intakeForms) {
    it(`${file} posts no key the markup does not also carry`, () => {
      const src = code(file);
      const names = new Set(
        [...src.matchAll(/\bname="([A-Za-z0-9_]+)"/g)].map((m) => m[1]!),
      );
      for (const assignment of src.matchAll(/\bbody\.([A-Za-z0-9_]+)\s*=/g)) {
        const key = assignment[1]!;
        expect(
          names.has(key),
          `${file} sets body.${key} in JavaScript and has no field named "${key}". `
          + 'A browser submitting this form by itself cannot send that key, so the '
          + 'schema refuses the whole submission and the person is told nothing they '
          + 'can act on.',
        ).toBe(true);
      }
    });
  }
});
