'use server';

/**
 * The request action's entry point. W6.
 *
 * `providerId` arrives from a hidden field, which is to say from the browser, which is
 * to say it is not trusted. It does not need to be: `requestProvider` resolves it
 * against this household's own bench under the household's own claims, so an id the
 * household has no business naming comes back not found rather than acted upon. The
 * field is a convenience, not an authorisation.
 */
import { revalidatePath } from 'next/cache';
import { getPortalSession } from '@/lib/session';
import { requestProvider } from '@/lib/request';
import { RequestProviderSchema } from '@/lib/schemas/request';
import {
  ALREADY, ASKED, FAILED, NOT_FOUND, UNAVAILABLE, type RequestState,
} from '@/lib/requestState';

export async function askAboutProvider(
  _previous: RequestState,
  form: FormData,
): Promise<RequestState> {
  const session = await getPortalSession();
  if (!session || session.role !== 'household') {
    return { state: 'refused', message: NOT_FOUND };
  }

  const parsed = RequestProviderSchema.safeParse({
    providerId: form.get('providerId'),
    note: typeof form.get('note') === 'string' ? form.get('note') : undefined,
  });
  if (!parsed.success) return { state: 'refused', message: NOT_FOUND };

  try {
    const outcome = await requestProvider(session, parsed.data);
    if (!outcome.ok) {
      return {
        state: 'refused',
        message: outcome.reason === 'unavailable' ? UNAVAILABLE : NOT_FOUND,
      };
    }

    // So the profile re-renders knowing an open request exists.
    revalidatePath(`/portal/provider/${parsed.data.providerId}`);
    return outcome.alreadyAsked
      ? { state: 'already', message: ALREADY }
      : { state: 'asked', message: ASKED };
  } catch (err) {
    console.error('[request] could not record', err);
    return { state: 'error', message: FAILED };
  }
}
