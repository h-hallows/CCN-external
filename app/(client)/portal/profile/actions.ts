'use server';

/**
 * Saving the household's own profile document. W7.
 *
 * `caseId` comes from the browser and is not trusted: `saveCaseProfile` runs the UPDATE
 * under the household's own claims, so a case they do not own matches no row and comes
 * back not found. Migration 0003's guard trigger refuses an UPDATE that changes any
 * column but `household_profile`, whatever this action sends.
 */
import { getPortalSession } from '@/lib/session';
import { PROFILE_MAX, saveCaseProfile } from '@/lib/caseProfile';

export interface ProfileSaveResult {
  ok: boolean;
  /** Said to the household only when something went wrong. */
  message?: string;
  savedAt?: string;
}

export async function saveProfile(
  caseId: string,
  body: string,
): Promise<ProfileSaveResult> {
  const session = await getPortalSession();
  if (!session || session.role !== 'household') {
    return { ok: false, message: 'Your session has expired. Open the portal again and your words will still be here.' };
  }
  if (typeof caseId !== 'string' || typeof body !== 'string') {
    return { ok: false, message: 'We could not save that just now.' };
  }
  if (body.length > PROFILE_MAX) {
    return {
      ok: false,
      message: `That is longer than we can store — ${PROFILE_MAX.toLocaleString()} characters is the limit. Nothing has been lost; shorten it and it will save.`,
    };
  }

  const outcome = await saveCaseProfile(session, caseId, body);
  if (outcome.ok) return { ok: true, savedAt: outcome.savedAt };

  return {
    ok: false,
    message: outcome.reason === 'not_found'
      ? 'We could not find that case on your account.'
      : 'We could not save that just now. Your words are still on this page — leave it open and we will try again.',
  };
}
