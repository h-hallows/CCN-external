'use client';

/**
 * The request form on a provider's profile. W6.
 *
 * The whole surface is one button and an optional note. There is no date picker, no
 * shift selector, no start-time field and no "when do you need them" — every one of
 * those would be the interface of a booking, and a registry does not take bookings. It
 * takes a request, and a person rings back.
 *
 * `disabled` is a courtesy, not a control. The action re-checks eligibility server side
 * on every submission, because a credential can lapse between this render and the click.
 */
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { askAboutProvider } from '@/app/(client)/portal/provider/[id]/actions';
import { IDLE, type RequestState } from '@/lib/requestState';

function Submit({ disabled, label }: { disabled: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn btn-primary"
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
    >
      {pending ? 'Sending…' : label}
    </button>
  );
}

export function RequestProvider({
  providerId,
  firstName,
  available,
  openedOn,
}: {
  providerId: string;
  /** Used only in the button label, so it reads like a sentence rather than a form. */
  firstName: string;
  available: boolean;
  /** Set when this household already has an open request about them. */
  openedOn: string | null;
}) {
  const [result, submit] = useActionState<RequestState, FormData>(askAboutProvider, IDLE);

  // An answer from the server replaces the form. Leaving the form up next to a
  // confirmation invites a second identical ask, and the operator reads both.
  if (result.state !== 'idle') {
    return (
      <p
        role="status"
        style={{
          border: '1px solid var(--line-2)',
          padding: '.85rem 1rem',
          maxWidth: 'var(--measure)',
          fontSize: 'var(--step--1)',
          color: result.state === 'error' ? 'var(--ink)' : 'var(--ink-2)',
        }}
      >
        {result.message}
      </p>
    );
  }

  if (openedOn) {
    return (
      <p
        style={{
          border: '1px solid var(--line-2)',
          padding: '.85rem 1rem',
          maxWidth: 'var(--measure)',
          fontSize: 'var(--step--1)',
          color: 'var(--ink-2)',
        }}
      >
        You asked us about {firstName} on <span className="nums">{openedOn}</span>. It is
        on our list and we will call you.
      </p>
    );
  }

  return (
    <form action={submit} style={{ maxWidth: 'var(--measure)' }}>
      <input type="hidden" name="providerId" value={providerId} />

      <label
        htmlFor="request-note"
        className="label"
        style={{ display: 'block', marginBottom: '.4rem' }}
      >
        Anything you would like us to pass on (optional)
      </label>
      <textarea
        id="request-note"
        name="note"
        rows={3}
        maxLength={1000}
        disabled={!available}
        placeholder="Mornings would suit us better, if that is possible."
        style={{
          width: '100%',
          padding: '.6rem .75rem',
          border: '1px solid var(--line-2)',
          background: 'var(--surface)',
          color: 'var(--ink)',
          font: 'inherit',
          fontSize: 'var(--step--1)',
        }}
      />

      <div style={{ marginTop: '.85rem' }}>
        <Submit disabled={!available} label={`Ask us about ${firstName}`} />
      </div>

      <p style={{ marginTop: '.75rem', fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
        {available ? (
          <>
            This tells us you are interested. Nothing is arranged until we have spoken
            to you, and you are not committing to anything by asking.
          </>
        ) : (
          /*
           * Says why the control beside it does nothing. A disabled button with copy
           * inviting you to press it is worse than no button: the household reads the
           * invitation, tries, and concludes the site is broken.
           */
          <>
            We have turned this off while we check something on {firstName}&rsquo;s
            file. It comes back on by itself once that is settled.
          </>
        )}
      </p>
    </form>
  );
}
