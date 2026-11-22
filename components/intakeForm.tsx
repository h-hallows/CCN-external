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
import { useState } from 'react';
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
      return {
        state: 'error',
        fieldErrors: payload.fieldErrors ?? {},
        message: payload.message
          ?? (payload.fieldErrors
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

/** A labelled control, with whatever the server said about it underneath. */
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
  return (
    <div>
      <label htmlFor={id} className="label" style={{ display: 'block', marginBottom: '.35rem' }}>
        {label}
      </label>
      {children}
      {hint ? (
        <p style={{
          margin: '.35rem 0 0', fontSize: 'var(--step--1)', color: 'var(--ink-3)',
        }}>
          {hint}
        </p>
      ) : null}
      {bad ? (
        <p style={{ margin: '.35rem 0 0', fontSize: 'var(--step--1)', color: 'var(--crit)' }}>
          {errors!.join('. ')}
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

export function Group({
  legend, hint, children,
}: { legend: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: '0 0 2rem' }}>
      <legend style={{ fontSize: 'var(--step-0)' }}>{legend}</legend>
      {hint ? (
        <p style={{ fontSize: 'var(--step--1)', color: 'var(--ink-3)', margin: '.4rem 0 0' }}>
          {hint}
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

/** What someone sees once it has gone. */
export function Confirmation({
  message, reference, children,
}: { message: string; reference: string; children?: React.ReactNode }) {
  return (
    <div
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

/** The submit row, with whatever the server said about the form as a whole. */
export function Submit({
  label, sendingLabel, result,
}: { label: string; sendingLabel: string; result: IntakeState }) {
  return (
    <>
      <button type="submit" className="btn btn-primary" disabled={result.state === 'sending'}>
        {result.state === 'sending' ? sendingLabel : label}
      </button>
      {result.state === 'error' ? (
        <p role="status" aria-live="polite" style={{
          marginTop: '1rem', fontSize: 'var(--step--1)', color: 'var(--crit)',
        }}>
          {result.message}
        </p>
      ) : null}
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
