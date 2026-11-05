/**
 * Feedback on the REFERRAL SERVICE. Web build spec § 4.1, W7.
 *
 * THE DISTINCTION THIS MODULE EXISTS TO HOLD. The questions are about CCN, not about
 * the provider. § 687.2(e) and invariant I7: feedback may inform future referral
 * decisions and may never be routed into provider discipline, coaching, training,
 * performance improvement or any corrective workflow. A five-star rating of a named
 * nurse is the first step of exactly that workflow, so there isn't one — the rating
 * asks how well the introduction worked, and the free text is addressed to us.
 *
 * `use_restriction` is written on every row and the database CHECKs that it can only
 * ever be 'referral_decisions_only'. The column is not a label on the data; it is the
 * only value the table accepts.
 *
 * THIS MODULE READS `referrals`, AND IT IS THE ONLY ONE IN (client) THAT MAY.
 * The W6 gate in tests/request.test.ts asserts that nothing reachable from app/(client)
 * WRITES to referrals, timeline_entries or disclosures, and separately that only this
 * route reads one. A feedback form needs to know which referral it is about and that it
 * belongs to this household; `referrals_household_select` already grants exactly that
 * and nothing more. Creating one remains impossible from here: there is no INSERT
 * policy for any role but the operator.
 */
import { asPortalUser } from './portalDb';
import type { PortalSession } from './session';

export interface FeedbackSubject {
  referralId: string;
  providerName: string;
  referredOn: string;
  /** Set when this household has already answered for this referral. */
  answeredOn: string | null;
}

export interface FeedbackInput {
  referralId: string;
  /** How well the introduction worked. About the service, never about the person. */
  introductionRating: number;
  wouldAskAgain: boolean;
  notes?: string;
}

export type FeedbackOutcome =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'already_answered' | 'invalid' | 'failed' };

export async function feedbackSubject(
  session: PortalSession,
  referralId: string,
): Promise<FeedbackSubject | null> {
  if (!session.householdId) return null;

  return asPortalUser(session, async (tx) => {
    const rows = await tx.query<{
      id: string; referred_at: string; full_name: string | null;
    }>(
      // Scoped by referrals_household_select. A referral on somebody else's case is
      // not found, which is also what a made-up id returns.
      `SELECT r.id, r.referred_at::text, p.full_name
         FROM referrals r
         LEFT JOIN providers p ON p.id = r.provider_id
        WHERE r.id = $1`,
      [referralId],
    );
    const row = rows[0];
    if (!row) return null;

    const existing = await tx.query<{ at: string }>(
      `SELECT at::text FROM referral_feedback WHERE referral_id = $1
        ORDER BY at LIMIT 1`,
      [referralId],
    );

    return {
      referralId: row.id,
      providerName: row.full_name ?? 'the person we introduced',
      referredOn: row.referred_at.slice(0, 10),
      answeredOn: existing[0]?.at.slice(0, 10) ?? null,
    };
  });
}

export async function saveFeedback(
  session: PortalSession,
  input: FeedbackInput,
): Promise<FeedbackOutcome> {
  if (!session.householdId) return { ok: false, reason: 'not_found' };
  if (!Number.isInteger(input.introductionRating)
      || input.introductionRating < 1 || input.introductionRating > 5) {
    return { ok: false, reason: 'invalid' };
  }

  const subject = await feedbackSubject(session, input.referralId);
  if (!subject) return { ok: false, reason: 'not_found' };
  // Answered once. A statement that can be revised afterwards is a weaker record of
  // what was said, and there is deliberately no UPDATE policy to revise it with.
  if (subject.answeredOn) return { ok: false, reason: 'already_answered' };

  try {
    await asPortalUser(session, (tx) => tx.query(
      // use_restriction is passed explicitly rather than left to its default, because
      // the policy's WITH CHECK requires it and a reader of this statement should see
      // the restriction being written rather than have to go and look it up.
      `INSERT INTO referral_feedback
         (referral_id, referral_service_rating, would_refer_again, notes, use_restriction)
       VALUES ($1, $2, $3, $4, 'referral_decisions_only')`,
      [
        input.referralId,
        input.introductionRating,
        input.wouldAskAgain,
        input.notes?.trim() ? input.notes.trim() : null,
      ],
    ));
    return { ok: true };
  } catch (err) {
    console.error('[feedback] could not record', err);
    return { ok: false, reason: 'failed' };
  }
}
