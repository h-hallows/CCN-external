'use client';

/**
 * A form that saves through a server action and says so. Used by every provider screen.
 *
 * One component rather than five near-identical ones, because the differences between
 * these forms are their fields and nothing else — and a save that reports differently
 * on each screen is the kind of inconsistency that makes somebody re-check whether it
 * worked.
 */
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { PRO_IDLE, type ProFormState } from '@/lib/proState';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

export function SaveForm({
  action,
  label = 'Save',
  footnote,
  children,
}: {
  action: (previous: ProFormState, form: FormData) => Promise<ProFormState>;
  label?: string;
  footnote?: string;
  children: React.ReactNode;
}) {
  const [result, submit] = useActionState<ProFormState, FormData>(action, PRO_IDLE);

  return (
    <form action={submit} style={{ maxWidth: 'var(--measure)' }}>
      {children}

      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        gap: '1rem', marginTop: '1.1rem',
      }}>
        <Submit label={label} />
        <span
          role="status"
          aria-live="polite"
          style={{
            fontSize: 'var(--step--1)',
            color: result.state === 'error' ? 'var(--ink)' : 'var(--ink-3)',
          }}
        >
          {result.state === 'idle' ? '' : result.message}
        </span>
      </div>

      {footnote ? (
        <p style={{ marginTop: '.85rem', fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
          {footnote}
        </p>
      ) : null}
    </form>
  );
}

/** Shared field styling, so the provider screens do not drift from each other. */
export const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '.65rem .8rem',
  border: '1px solid var(--line-2)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  font: 'inherit',
  fontSize: 'var(--step--1)',
  lineHeight: 1.6,
};
