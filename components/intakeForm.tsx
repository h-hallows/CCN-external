'use client';

/**
 * The shared machinery behind the three public forms. Web build spec § 3.1.
 *
 * All three post JSON to a route that validates with the same schema it stores from,
 * rate-limits, carries a honeypot and answers with `{ ok, message, reference }` or
 * `{ ok: false, fieldErrors }`. Written out three times, that mechanism drifts: the
 * partner form was the only one that existed, and it discarded `fieldErrors` entirely —
 * so a rejected submission showed one generic sentence and left the person guessing
 * which of fourteen fields the server had refused.
 *
 * So the submit, the state machine and the error surfacing live here, and each form is
 * its fields plus what it says afterwards.
 */
import { cloneElement, isValidElement, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { fieldStyle } from '@/components/SaveForm';

export type FieldErrors = Record<string, string[] | undefined>;

export type IntakeState =
  | { state: 'idle' }
  | { state: 'sending' }
  | { state: 'sent'; message: string; reference: string }
  | { state: 'error'; message: string; fieldErrors: FieldErrors };

export const IDLE: IntakeState = { state: 'idle' };

/**
 * Post a form to one of the intake routes.
 *
 * `shape` is where a form turns its own FormData into what its schema expects — a
 * checkbox into a boolean, repeated checkboxes into an array. The schemas are
 * `.strict()`, so an extra key is a rejection rather than a silently dropped field,
 * which is the right posture at a public write boundary and means this cannot be a
 * generic "send everything" helper.
 */
export async function postIntake(
  endpoint: string,
  form: FormData,
  shape?: (body: Record<string, unknown>, form: FormData) => void,
): Promise<IntakeState> {
  const body: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') body[key] = value;
  }
  shape?.(body, form);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json() as {
      ok?: boolean; message?: string; reference?: string; fieldErrors?: FieldErrors;
    };
    if (!response.ok || !payload.ok) {
      const fieldErrors = payload.fieldErrors ?? {};
      /*
       * Whether there is anything to point AT, not whether the key came back. This read
       * `payload.fieldErrors ? ... : ...`, and an object-level rejection answers with
       * `fieldErrors: {}` — truthy. So a visitor whose form was refused as a whole was
       * sent to "the notes below" and the notes below were an empty space: the one
       * failure the form could not recover from was also the only one it explained
       * nothing about.
       */
      const pointed = Object.values(fieldErrors).some((m) => (m?.length ?? 0) > 0);
      return {
        state: 'error',
        fieldErrors,
        message: payload.message
          ?? (pointed
            ? 'Some of that needs another look — see the notes below.'
            : 'We could not take that just now. Please call us instead — it is quicker anyway.'),
      };
    }
    return {
      state: 'sent',
      message: payload.message ?? 'Received.',
      reference: payload.reference ?? '',
    };
  } catch {
    return {
      state: 'error',
      fieldErrors: {},
      message: 'We could not take that just now. Please call us instead.',
    };
  }
}

/**
 * A labelled control, with whatever the server said about it underneath.
 *
 * THE DEFECT THIS COMPONENT HAD. The label was associated — `htmlFor` has always been
 * here — and the two things printed under the control were not associated with anything
 * at all. There were exactly zero `aria-describedby` attributes and zero `aria-invalid`
 * in the rendered application, on all three public forms, which means:
 *
 *   - The HINT was invisible to a screen reader. On /enquire that hint is the sentence
 *     asking people to leave diagnoses and medication off a web form, and on /apply it
 *     is the one saying a licence number is checked against the issuing board. Both are
 *     instructions, not decoration, and both were announced only to somebody who could
 *     see them.
 *   - The ERROR was announced to nobody. A refused submission said "see the notes below"
 *     and the notes were coloured paragraphs floating beside the fields: tabbing to the
 *     telephone box after a rejection said "Your phone, edit text" and not one word
 *     about why it had come back. The visitor had a form that would not go and no way to
 *     find out which field was the problem.
 *
 * WHY IT CLONES THE CHILD. `Field` does not own its control — each form passes its own
 * `<input>`, `<select>` or `<textarea>`, which is what lets the three forms differ in
 * what they ask without differing in how they ask it. So the two attributes are added
 * to the child here, once, and the fourth form somebody writes gets them without
 * knowing they exist. Writing them at each of the twenty-odd call sites is the version
 * that is true until the next field is added — the shape this codebase keeps rejecting.
 *
 * It merges rather than overwrites any `aria-describedby` the caller set, so a field
 * that wants a third description is not silently stripped of it.
 */
export function Field({
  id, label, hint, errors, children,
}: {
  id: string;
  label: string;
  hint?: string;
  errors?: string[] | undefined;
  children: React.ReactNode;
}) {
  const bad = (errors?.length ?? 0) > 0;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  /*
   * Only ids that are actually rendered. `aria-describedby` pointing at an element that
   * is not in the document is announced as nothing by some engines and skipped silently
   * by others — an aria attribute that is wrong is worse than one that is absent, so the
   * error id appears exactly while the error paragraph does.
   */
  const describedBy = [hint ? hintId : null, bad ? errorId : null].filter(Boolean);

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
      'aria-describedby': [
        ...describedBy,
        ...String((children as ReactElement<Record<string, unknown>>).props['aria-describedby'] ?? '')
          .split(/\s+/)
          .filter(Boolean),
      ].join(' ') || undefined,
      // Absent rather than "false" when the field is fine: aria-invalid="false" is
      // correct and some older screen readers read it aloud anyway.
      ...(bad ? { 'aria-invalid': true } : {}),
    })
    : children;

  return (
    <div>
      <label htmlFor={id} className="label" style={{ display: 'block', marginBottom: '.35rem' }}>
        {label}
      </label>
      {control}
      {hint ? (
        <p id={hintId} style={{
          margin: '.35rem 0 0', fontSize: 'var(--step--1)', color: 'var(--ink-3)',
        }}>
          {hint}
        </p>
      ) : null}
      {bad ? (
        /*
         * The word "Error" is not ornament. The only thing separating this paragraph
         * from the hint directly above it was its colour — same size, same place, same
         * weight — so to anybody who does not see colour the two were one block of grey
         * text and the refusal was indistinguishable from advice (§ 1.4.1).
         */
        <p id={errorId} style={{
          margin: '.35rem 0 0', fontSize: 'var(--step--1)', color: 'var(--crit)',
        }}>
          <strong>Error:</strong> {errors!.join('. ')}
        </p>
      ) : null}
    </div>
  );
}

/** A field whose border says it was refused, without relying on colour alone. */
export function inputStyle(errors?: string[] | undefined): React.CSSProperties {
  return (errors?.length ?? 0) > 0
    ? { ...fieldStyle, borderColor: 'var(--crit)', borderWidth: 2 }
    : fieldStyle;
}

export const twoUp: React.CSSProperties = {
  display: 'grid', gap: '1rem', marginTop: '1rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
};

/**
 * A fieldset with a legend, a hint and — now — somewhere for an error that belongs to
 * the group rather than to one control.
 *
 * `errors` IS NOT A CONVENIENCE. The two checkbox grids on /apply (where you work, what
 * you speak) are each refused as a whole, because the answer is the set and not any one
 * box; so the form was printing its own red paragraph above each grid, associated with
 * nothing, describing nothing, and announced to nobody. There is no single control to
 * hang `aria-describedby` on in a grid of thirty checkboxes — the thing that is invalid
 * is the group, so the association belongs on the fieldset, where a screen reader reads
 * it on entering the group. Passing it through here means the next grid somebody adds
 * cannot get this wrong by writing its own paragraph, which is exactly how both of the
 * existing ones got it wrong.
 */
/**
 * A group's error id, derived from its legend.
 *
 * Exported because one control inside a group may want to point at the group's error as
 * well — the consent tick on the partner form is refused on its own, and the planner who
 * tabs onto it should hear why. Two files computing the same id by hand is how you get a
 * describedby aimed at nothing, which is the kind of aria that is worse than none.
 */
export function groupErrorId(legend: string): string {
  return `${legend.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-error`;
}

export function Group({
  legend, hint, errors, children,
}: {
  legend: string;
  hint?: string;
  errors?: string[] | undefined;
  children: React.ReactNode;
}) {
  const bad = (errors?.length ?? 0) > 0;
  const errorId = groupErrorId(legend);
  // From the legend too, so two groups on one form cannot collide.
  const hintId = errorId.replace(/-error$/, '-hint');
  const describedBy = [hint ? hintId : null, bad ? errorId : null].filter(Boolean).join(' ');

  return (
    <fieldset
      style={{ border: 0, padding: 0, margin: '0 0 2rem' }}
      aria-describedby={describedBy || undefined}
      {...(bad ? { 'aria-invalid': true } : {})}
    >
      {/*
        * THE GROUP HEADING LOOKED EXACTLY LIKE A SENTENCE.
        *
        * It computed to 16.96px, weight 400, in the body face and --ink — the same as
        * the paragraph above it — so "What you need", "How to reach you" and "Anything
        * else" carried no more weight than prose, and a fourteen-field form read as one
        * flat run of boxes instead of three short stages. A long form that shows its
        * stages is a shorter form to the person filling it in.
        *
        * The display face at --step-1 rather than `.label`: `.label` is what every
        * field's own label is set in, three lines below, and a group heading that
        * matches its children is not a hierarchy. The rule under it is the same
        * hairline a card uses.
        */}
      <legend style={{
        fontFamily: 'var(--display)',
        fontSize: 'var(--step-1)',
        color: 'var(--ink)',
        paddingBottom: '.4rem',
        marginBottom: '.5rem',
        borderBottom: '1px solid var(--line)',
        width: '100%',
      }}>
        {legend}
      </legend>
      {hint ? (
        <p id={hintId} style={{
          fontSize: 'var(--step--1)', color: 'var(--ink-3)', margin: '.4rem 0 0',
        }}>
          {hint}
        </p>
      ) : null}
      {bad ? (
        <p id={errorId} style={{
          margin: '.4rem 0 0', fontSize: 'var(--step--1)', color: 'var(--crit)',
        }}>
          <strong>Error:</strong> {errors!.join('. ')}
        </p>
      ) : null}
      {children}
    </fieldset>
  );
}

/** Not hidden with display:none, which some bots check for. */
export function Honeypot() {
  return (
    <div aria-hidden style={{ position: 'absolute', left: '-9999px' }}>
      <label htmlFor="honeypot">Leave this empty</label>
      <input id="honeypot" name="honeypot" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

/**
 * What someone sees once it has gone.
 *
 * THE ANNOUNCEMENT WAS PRESENT, CORRECT AND NEVER REACHED. `role="status"` was already
 * here, and it did nothing: a live region only announces changes that happen while it is
 * already in the document, and this one is mounted at the same moment as its text —
 * each form replaces the whole `<form>` with this on success. So a visitor who cannot
 * see the screen sent the enquiry, the form vanished, focus fell to the top of the
 * document because the submit button it was sitting on had been unmounted, and nothing
 * was said. The one thing a form must tell you is whether it went.
 *
 * SO FOCUS MOVES HERE, which is the half that works whatever the engine does with the
 * live region. `tabIndex={-1}` makes the panel a focus target without adding a tab stop,
 * and the reader lands at the top of the confirmation with the rest of it — what happens
 * next, and the reference number — ahead of them in reading order rather than behind.
 * `role="status"` is kept for the engines that do announce an inserted region; at worst
 * the news arrives twice, where before it did not arrive.
 */
export function Confirmation({
  message, reference, children,
}: { message: string; reference: string; children?: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Not a scroll — `preventScroll` is deliberately absent, because the panel replaces
    // a form that may have been scrolled past and bringing it into view is the point.
    panel.current?.focus();
  }, []);

  return (
    <div
      ref={panel}
      tabIndex={-1}
      role="status"
      style={{
        border: '1px solid var(--line-2)', background: 'var(--surface)',
        padding: '1.5rem', maxWidth: 'var(--measure)',
      }}
    >
      <p style={{ marginTop: 0, fontSize: 'var(--step-1)' }}>{message}</p>
      {children}
      {reference ? (
        <p className="label nums" style={{ marginBottom: 0 }}>Your reference: {reference}</p>
      ) : null}
    </div>
  );
}

/**
 * The submit row, with whatever the server said about the form as a whole.
 *
 * THE LIVE REGION EXISTED AND COULD NOT FIRE. `role="status" aria-live="polite"` was on
 * a paragraph rendered only `{result.state === 'error' ? … : null}` — so the element
 * carrying the announcement was created in the same commit as the text it was meant to
 * announce. A live region announces changes to a region the engine is already watching;
 * one that arrives with its content is a region nothing was watching. The attribute was
 * right, the sentence was right, and the only person it ever reached was somebody
 * reading the screen. That is this repository's own failure mode written in ARIA.
 *
 * The region is therefore always in the document and only its text changes. It is also
 * the one place a form says something about itself as a whole — `.strict()` makes an
 * object-level rejection an everyday outcome, and that is the refusal with no field to
 * point at.
 *
 * AND THE BUTTON IS NO LONGER `disabled` WHILE SENDING. Disabling the element that
 * currently has focus throws focus to the top of the document in every engine, so a
 * keyboard or screen-reader user pressed Send and lost their place in the form while
 * waiting to find out whether it had worked. `aria-disabled` says the same thing to
 * assistive technology, `.btn[aria-disabled="true"]` in app/globals.css already styles
 * it the same way, and the click guard below is what actually stops the second
 * submission — an `aria-disabled` button with nothing refusing the press is a label
 * that lies.
 */
export function Submit({
  label, sendingLabel, result,
}: { label: string; sendingLabel: string; result: IntakeState }) {
  const sending = result.state === 'sending';
  return (
    <>
      <button
        type="submit"
        className="btn btn-primary"
        aria-disabled={sending}
        onClick={(event) => { if (sending) event.preventDefault(); }}
      >
        {sending ? sendingLabel : label}
      </button>
      <p
        role="status"
        aria-live="polite"
        style={{
          // No top margin while it is empty, or every form carries a blank line under
          // its button for the sake of a region nobody can see.
          marginTop: result.state === 'error' ? '1rem' : 0,
          marginBottom: 0,
          fontSize: 'var(--step--1)',
          color: 'var(--crit)',
        }}
      >
        {result.state === 'error' ? result.message : ''}
      </p>
    </>
  );
}

/** The state a form holds while it is being filled in. */
export function useIntake(): [IntakeState, (s: IntakeState) => void] {
  const [result, setResult] = useState<IntakeState>(IDLE);
  return [result, setResult];
}

export function errorsOf(result: IntakeState): FieldErrors {
  return result.state === 'error' ? result.fieldErrors : {};
}
