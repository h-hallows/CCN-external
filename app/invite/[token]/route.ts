/**
 * Invite acceptance. Architecture spec § 3.4 — there is no public signup for either
 * portal. The bench is curated and the referral requires a call; provider applications
 * are reviewed first.
 *
 * A route handler rather than a page: accepting an invite sets a session cookie, and
 * that is only permitted in a route handler or a server action.
 */
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { getDb } from '@h-hallows/core/db';
import { getPortalSession, hashToken, startSession } from '@/lib/session';
import { databaseAvailable } from '@/lib/availability';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<void> {
  const { token } = await params;

  // An invite link that 500s looks like a broken invite. Send them somewhere that
  // explains itself, and leave the invite unconsumed so the link still works later.
  if (!(await databaseAvailable()).ok) redirect('/login');

  /*
   * Refuse to swap an existing session for a different person.
   *
   * This route is a bare GET that wrote the cookie unconditionally, so one top-level
   * navigation to somebody else's invite link silently signed you in as them — and
   * the household profile autosaves, so the next thing typed (the door code, the 3am
   * routine) would have been written into the attacker's household under their own
   * claims. Row-level security cannot help with that: the claims are legitimately
   * theirs.
   *
   * Re-clicking your OWN link is fine and stays fine, which is the common case when
   * somebody re-opens an email. The invite is left unconsumed so the real recipient
   * can still use it.
   */
  const current = await getPortalSession();

  const { query } = await getDb();

  // Single use, unexpired, unrevoked. Claimed in the same statement that reads it, so
  // two simultaneous clicks cannot both succeed.
  const [invite] = await query<{
    id: string; email: string; role: string;
    household_id: string | null; provider_id: string | null; partner_id: string | null;
  }>(
    `UPDATE portal_invites
        SET accepted_at = now()
      WHERE token_hash = $1
        AND accepted_at IS NULL
        AND revoked_at IS NULL
        AND expires_at > now()
      RETURNING id, email, role::text AS role, household_id, provider_id, partner_id`,
    [hashToken(token)],
  );

  if (!invite) redirect('/login?error=invite');

  if (current && current.email !== invite.email) {
    redirect('/login?error=signed-in-as-someone-else');
  }

  /*
   * `disabled_at` is NOT cleared here any more.
   *
   * It is the documented way to withdraw someone's access, and disabling a user does
   * not revoke their outstanding invites — so any unexpired link still sitting in
   * their inbox re-enabled the account on click. Revocation has to outlast a link
   * that was issued before it.
   *
   * The role is still taken from the invite, because the operator issuing it is the
   * authority on what the person is.
   */
  const [user] = await query<{ id: string }>(
    `INSERT INTO users (email, display_name, role)
     VALUES ($1, $2, $3::user_role)
     ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
     RETURNING id, disabled_at`,
    [invite.email, invite.email.split('@')[0] ?? 'member', invite.role],
  );
  if (!user) redirect('/login?error=invite');
  if ((user as { disabled_at?: string | null }).disabled_at) {
    redirect('/login?error=invite');
  }

  if (invite.household_id) {
    await query(
      `INSERT INTO household_users (user_id, household_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [user.id, invite.household_id],
    );
  }
  if (invite.provider_id) {
    await query(
      `INSERT INTO provider_users (user_id, provider_id) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET provider_id = EXCLUDED.provider_id`,
      [user.id, invite.provider_id],
    );
  }
  if (invite.partner_id) {
    await query(
      `INSERT INTO partner_users (user_id, partner_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [user.id, invite.partner_id],
    );
  }

  await startSession(user.id);
  redirect(
    invite.role === 'provider' ? '/pro'
      : invite.role === 'partner' ? '/partner'
      : '/portal',
  );
}
