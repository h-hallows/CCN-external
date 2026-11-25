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

/**
 * Shared field styling, so the provider screens do not drift from each other.
 *
 * NO FONT SIZE HERE, AND NONE IN ANY OTHER FIELD STYLE. This object said
 * `fontSize: 'var(--step--1)'` — about 14px — and it is the style behind every field on
 * the public forms and the provider screens, so every one of them zoomed Mobile Safari
 * on focus and left the visitor zoomed in. app/globals.css now floors every text-entry
 * control at 16px and an inline font size is the one thing that could undercut it, so
 * the size is the stylesheet's to decide and this says nothing about it.
 *
 * The padding is left as it was: at the floored size a field stands 48px tall, which
 * clears the 44px minimum for something aimed at with a thumb.
 */
export const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '.65rem .8rem',
  border: '1px solid var(--line-2)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  lineHeight: 1.6,
};
