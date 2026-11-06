'use server';

/**
 * Every provider-authored write. Web build spec § 4.2, W8.
 *
 * Each one re-reads the session server side and passes the provider's own claims into
 * the statement, so `providers_own_update` scopes the row. On top of that, migration
 * 0003's guard trigger raises on any UPDATE touching a column a provider may not set —
 * status, areas, name, type, licence, the agreement and verification dates — whatever
 * these functions send. The credential submission writes to `credential_submissions`,
 * never to `credentials`: see lib/pro.ts.
 */
import { revalidatePath } from 'next/cache';
import { getPortalSession } from '@/lib/session';
import {
  saveAvailability, saveLimits, savePhoto, saveProviderProfile, saveRate,
  submitCredential, type SaveResult,
} from '@/lib/pro';
import {
  FILE_EMPTY, FILE_TOO_BIG, FILE_WRONG_TYPE, NOT_YOURS, SAVED, SAVE_FAILED,
  type ProFormState,
} from '@/lib/proState';

/** Which refusal to say out loud. Anything not here is the generic failure. */
const FILE_PROBLEM: Record<string, string> = {
  file_type: FILE_WRONG_TYPE,
  file_empty: FILE_EMPTY,
  file_large: FILE_TOO_BIG,
};

const text = (form: FormData, key: string): string => {
  const v = form.get(key);
  return typeof v === 'string' ? v : '';
};

function report(result: SaveResult, path: string): ProFormState {
  if (result.ok) {
    revalidatePath(path);
    return { state: 'saved', message: SAVED };
  }
  if (result.reason === 'not_found') return { state: 'error', message: NOT_YOURS };
  return {
    state: 'error',
    message: result.message ?? SAVE_FAILED,
  };
}

async function provider() {
  const session = await getPortalSession();
  return session && session.role === 'provider' ? session : null;
}

export async function updateProfile(
  _previous: ProFormState, form: FormData,
): Promise<ProFormState> {
  const session = await provider();
  if (!session) return { state: 'error', message: NOT_YOURS };
  return report(await saveProviderProfile(session, {
    preferredName: text(form, 'preferredName'),
    bio: text(form, 'bio'),
    phone: text(form, 'phone'),
    email: text(form, 'email'),
  }), '/pro/profile');
}

export async function updatePhoto(
  _previous: ProFormState, form: FormData,
): Promise<ProFormState> {
  const session = await provider();
  if (!session) return { state: 'error', message: NOT_YOURS };
  return report(await savePhoto(session, {
    photoUrl: text(form, 'photoUrl'),
    consent: form.get('consent') === 'yes',
  }), '/pro/profile');
}

export async function updateRate(
  _previous: ProFormState, form: FormData,
): Promise<ProFormState> {
  const session = await provider();
  if (!session) return { state: 'error', message: NOT_YOURS };
  return report(await saveRate(session, {
    rateHourly: text(form, 'rateHourly'),
    rateNotes: text(form, 'rateNotes'),
  }), '/pro/rate');
}

export async function updateAvailability(
  _previous: ProFormState, form: FormData,
): Promise<ProFormState> {
  const session = await provider();
  if (!session) return { state: 'error', message: NOT_YOURS };
  // Every checked box arrives under the same key. An empty week is a valid answer and
  // must save as one, so this does not guard against the list being empty.
  const slots = form.getAll('slot').filter((s): s is string => typeof s === 'string');
  return report(await saveAvailability(session, slots), '/pro/availability');
}

export async function updateLimits(
  _previous: ProFormState, form: FormData,
): Promise<ProFormState> {
  const session = await provider();
  if (!session) return { state: 'error', message: NOT_YOURS };
  return report(await saveLimits(session, text(form, 'restrictions')), '/pro/limits');
}

export async function handInCredential(
  _previous: ProFormState, form: FormData,
): Promise<ProFormState> {
  const session = await provider();
  if (!session) return { state: 'error', message: NOT_YOURS };
  const type = text(form, 'type');
  if (type === '') return { state: 'error', message: 'Choose what this is first.' };

  const upload = form.get('file');
  const file = upload instanceof File && upload.size > 0
    ? {
      name: upload.name,
      contentType: upload.type,
      bytes: Buffer.from(await upload.arrayBuffer()),
    }
    : undefined;

  const result = await submitCredential(session, {
    type,
    identifier: text(form, 'identifier'),
    note: text(form, 'note'),
    file,
  });
  if (!result.ok) {
    return { state: 'error', message: FILE_PROBLEM[result.reason] ?? SAVE_FAILED };
  }
  revalidatePath('/pro/credentials');
  return {
    state: 'saved',
    message: 'Handed in. We will check it against the issuing body and record the expiry.',
  };
}

