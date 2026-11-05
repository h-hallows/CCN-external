'use client';

/**
 * Two questions about the referral service, and free text. Web build spec § 4.1, W7.
 *
 * There is no star rating of a person here and there will not be one. The scale asks
 * how well the introduction suited what the household needed — that is a question
 * about CCN's judgement in putting them forward, and it is the question § 687.2(e)
 * allows. See lib/feedbackState.ts.
 */
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitFeedback } from '@/app/(client)/portal/feedback/[referralId]/actions';
import {
  AGAIN_QUESTION, IDLE, NOTES_QUESTION, RATING_HIGH, RATING_LOW, RATING_QUESTION,
  USE_NOTE, type FeedbackState,
} from '@/lib/feedbackState';

const SCALE = [1, 2, 3, 4, 5] as const;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? 'Sending…' : 'Send this to us'}
    </button>
  );
}

export function ReferralFeedback({ referralId }: { referralId: string }) {
  const [result, submit] = useActionState<FeedbackState, FormData>(submitFeedback, IDLE);

  if (result.state !== 'idle') {
    return (
      <p
        role="status"
        style={{
          border: '1px solid var(--line-2)', padding: '.85rem 1rem',
          maxWidth: 'var(--measure)', fontSize: 'var(--step--1)',
          color: result.state === 'error' ? 'var(--ink)' : 'var(--ink-2)',
        }}
      >
        {result.message}
      </p>
    );
  }

  return (
    <form action={submit} style={{ maxWidth: 'var(--measure)' }}>
      <input type="hidden" name="referralId" value={referralId} />

      <fieldset style={{ border: 0, padding: 0, margin: '0 0 1.75rem' }}>
        <legend style={{ fontSize: 'var(--step-0)', marginBottom: '.6rem' }}>
          {RATING_QUESTION}
        </legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>{RATING_LOW}</span>
          {SCALE.map((n) => (
            <label key={n} style={{
              display: 'inline-flex', alignItems: 'center', gap: '.35rem',
              fontSize: 'var(--step--1)',
            }}>
              <input type="radio" name="introductionRating" value={n} required />
              {n}
            </label>
          ))}
          <span style={{ fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>{RATING_HIGH}</span>
        </div>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: '0 0 1.75rem' }}>
        <legend style={{ fontSize: 'var(--step-0)', marginBottom: '.6rem' }}>
          {AGAIN_QUESTION}
        </legend>
        <div style={{ display: 'flex', gap: '1.25rem' }}>
          {/* Rendered identically. A default answer is not an answer. */}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', fontSize: 'var(--step--1)' }}>
            <input type="radio" name="wouldAskAgain" value="yes" required /> Yes
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', fontSize: 'var(--step--1)' }}>
            <input type="radio" name="wouldAskAgain" value="no" required /> No
          </label>
        </div>
      </fieldset>

      <label
        htmlFor="feedback-notes"
        style={{ display: 'block', fontSize: 'var(--step-0)', marginBottom: '.6rem' }}
      >
        {NOTES_QUESTION}
      </label>
      <textarea
        id="feedback-notes"
        name="notes"
        rows={5}
        maxLength={2000}
        style={{
          width: '100%', padding: '.7rem .85rem',
          border: '1px solid var(--line-2)', background: 'var(--surface)',
          color: 'var(--ink)', font: 'inherit', fontSize: 'var(--step--1)',
          lineHeight: 1.6, resize: 'vertical',
        }}
      />

      <div style={{ marginTop: '1.1rem' }}><Submit /></div>

      <p style={{ marginTop: '1rem', fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
        {USE_NOTE}
      </p>
    </form>
  );
}
