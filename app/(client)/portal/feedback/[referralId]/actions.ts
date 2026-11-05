'use server';

/**
 * Recording feedback on the referral service. W7.
 *
 * Reads the referral to confirm it belongs to this household, then inserts one
 * `referral_feedback` row with the use restriction written explicitly. It cannot create
 * or alter a referral: there is no INSERT or UPDATE policy on that table for any role
 * but the operator, and this module issues no such statement.
 */
import { getPortalSession } from '@/lib/session';
import { saveFeedback } from '@/lib/feedback';
import {
  ALREADY, FAILED, NOT_FOUND, THANKS, type FeedbackState,
} from '@/lib/feedbackState';

export async function submitFeedback(
  _previous: FeedbackState,
  form: FormData,
): Promise<FeedbackState> {
  const session = await getPortalSession();
  if (!session || session.role !== 'household') {
    return { state: 'refused', message: NOT_FOUND };
  }

  const referralId = form.get('referralId');
  const rating = Number(form.get('introductionRating'));
  const again = form.get('wouldAskAgain');
  const notes = form.get('notes');

  if (typeof referralId !== 'string' || !Number.isInteger(rating)) {
    return { state: 'refused', message: NOT_FOUND };
  }

  const outcome = await saveFeedback(session, {
    referralId,
    introductionRating: rating,
    wouldAskAgain: again === 'yes',
    notes: typeof notes === 'string' ? notes : undefined,
  });

  if (outcome.ok) {
    // Deliberately no revalidatePath here. Revalidating re-renders the server
    // component, which now finds the row and replaces the thank-you with "you have
    // already answered" — technically true and a strange thing to say to somebody who
    // answered two seconds ago. The client keeps the thanks; the notice is correct on
    // the next visit.
    return { state: 'thanks', message: THANKS };
  }

  if (outcome.reason === 'already_answered') {
    return { state: 'refused', message: ALREADY };
  }
  if (outcome.reason === 'failed') {
    return { state: 'error', message: FAILED };
  }
  return { state: 'refused', message: NOT_FOUND };
}
