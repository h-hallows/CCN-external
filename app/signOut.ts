'use server';

/**
 * Sign out. Web build spec § 4 — and, more to the point, basic hygiene.
 *
 * `endSession` existed in lib/session.ts from the beginning and was called from
 * nowhere: no portal rendered a control, so a session lasted its full fourteen days
 * and a person on a shared machine had no way to end one. An operator could only
 * disable the user, which until now an outstanding invite would undo.
 */
import { redirect } from 'next/navigation';
import { endSession } from '@/lib/session';

export async function signOut(): Promise<void> {
  await endSession();
  redirect('/login?signed-out=1');
}
