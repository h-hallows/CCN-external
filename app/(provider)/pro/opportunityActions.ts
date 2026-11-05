'use server';

/**
 * Answering an opportunity. W9.
 *
 * ONE ACTION FOR BOTH ANSWERS, taking `interested` as a value rather than two
 * functions. Two code paths would be two places for them to drift apart — different
 * validation, different logging, one of them acquiring a reason field — and
 * architecture spec § 6.4 requires that declining cost exactly what accepting costs.
 */
import { revalidatePath } from 'next/cache';
import { getPortalSession } from '@/lib/session';
import { respondToOpportunity } from '@/lib/opportunities';
import {
  ALREADY_ANSWERED, INTERESTED, NOT_FOUND, NOT_THIS_ONE, RESPOND_FAILED,
  type RespondState,
} from '@/lib/opportunityState';

export async function answerOpportunity(
  _previous: RespondState,
  form: FormData,
): Promise<RespondState> {
  const session = await getPortalSession();
  if (!session || session.role !== 'provider') {
    return { state: 'error', message: NOT_FOUND };
  }

  const referralId = form.get('referralId');
  const answer = form.get('answer');
  if (typeof referralId !== 'string' || (answer !== 'yes' && answer !== 'no')) {
    return { state: 'error', message: NOT_FOUND };
  }

  const result = await respondToOpportunity(session, referralId, answer === 'yes');
  if (result.ok) {
    /*
     * Deliberately NOT revalidating '/pro'. Doing so re-renders the server component,
     * which now finds no open opportunities and removes the whole section — taking
     * this component, and the acknowledgement, with it. The provider clicks and the
     * thing silently vanishes, which reads as a bug and gives no confirmation that a
     * decision was recorded.
     *
     * This is the second place the pattern bit: see the feedback action in
     * app/(client)/portal/feedback/[referralId]/actions.ts. The rule is that an action
     * must not revalidate a path whose re-render would unmount the component showing
     * its own result. Revalidating /pro/engagements is fine — nobody is looking at it.
     */
    revalidatePath('/pro/engagements');
    return {
      state: 'answered',
      message: answer === 'yes' ? INTERESTED : NOT_THIS_ONE,
    };
  }
  if (result.reason === 'already_answered') {
    return { state: 'error', message: ALREADY_ANSWERED };
  }
  if (result.reason === 'not_found') return { state: 'error', message: NOT_FOUND };
  return { state: 'error', message: RESPOND_FAILED };
}
