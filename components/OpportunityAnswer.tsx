'use client';

/**
 * Yes and no on an opportunity. Web build spec § 4.2, architecture § 6.4, W9.
 *
 * THE TWO BUTTONS ARE THE SAME BUTTON. Same element, same class, same width, same
 * order every time, differing only in their label and the value they submit. Neither
 * is `btn-primary`, because a primary button is a recommendation and a registry
 * recommending that a provider accept work is a registry directing it — § 687.2(e).
 *
 * NO COUNTDOWN. Nothing here renders a timer, a deadline, an "expires in", a relative
 * age or a colour that changes with time, and a test asserts the absence across the
 * whole provider tree. A countdown is pressure, pressure is direction, and the date it
 * was referred is a fact that does not push.
 */
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { answerOpportunity } from '@/app/(provider)/pro/opportunityActions';
import { RESPOND_IDLE, type RespondState } from '@/lib/opportunityState';

function Answer({ value, label }: { value: 'yes' | 'no'; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="answer"
      value={value}
      className="btn"
      disabled={pending}
      style={{ minWidth: '11rem', justifyContent: 'center' }}
    >
      {label}
    </button>
  );
}

export function OpportunityAnswer({ referralId }: { referralId: string }) {
  const [result, submit] = useActionState<RespondState, FormData>(
    answerOpportunity, RESPOND_IDLE);

  if (result.state !== 'idle') {
    return (
      <p
        role="status"
        style={{
          marginTop: '1rem', padding: '.8rem 1rem',
          border: '1px solid var(--line-2)', maxWidth: 'var(--measure)',
          fontSize: 'var(--step--1)',
          color: result.state === 'error' ? 'var(--ink)' : 'var(--ink-2)',
        }}
      >
        {result.message}
      </p>
    );
  }

  return (
    <form action={submit} style={{ marginTop: '1.25rem' }}>
      <input type="hidden" name="referralId" value={referralId} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem' }}>
        <Answer value="yes" label="Yes, I am interested" />
        <Answer value="no" label="Not this one" />
      </div>
      <p style={{ marginTop: '.75rem', fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
        Either answer is fine and neither is recorded as anything but your answer.
        Saying no costs you nothing — there is no record of how often you do.
      </p>
    </form>
  );
}
