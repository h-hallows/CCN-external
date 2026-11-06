import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { getDb } from '@h-hallows/core/db';
import { mailConfigured, sendMail } from '@h-hallows/core/mail';
import { getPortalSession, hashToken, newToken } from '@/lib/session';
import { rateLimit } from '@/lib/rateLimit';
import { databaseAvailable } from '@/lib/availability';
import { Unavailable } from '@/components/Unavailable';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function Login({
  searchParams,
}: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const available = await databaseAvailable();
  if (!available.ok) return <Unavailable what="Signing in" />;

  const existing = await getPortalSession();
  if (existing) redirect(existing.role === 'provider' ? '/pro' : '/portal');
  const params = await searchParams;

  async function sendLink(formData: FormData) {
    'use server';

    /*
     * Configuration is decided BEFORE the address is looked up, and must stay that way.
     * Whether a mailer exists is the same fact for every address; whether a link was
     * issued is not. Branching after the lookup would turn this form into a way to find
     * out which families use us — the exact thing the rest of this function is built to
     * prevent.
     */
    if (!mailConfigured()) redirect('/login?error=mail');

    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const h = await headers();

    const fake = new Request('http://localhost/login', {
      headers: { 'x-forwarded-for': h.get('x-forwarded-for') ?? 'unknown' },
    });
    if (await rateLimit(fake, { key: 'login', max: 5, windowSec: 600 })) {
      redirect('/login?sent=1');
    }

    const { query } = await getDb();
    // Only an existing portal user. There is no signup here, and the response never
    // says whether the address is known — a login form that distinguishes is a way to
    // find out which families use us.
    const [user] = await query<{ id: string }>(
      `SELECT id FROM users
        WHERE email = $1 AND disabled_at IS NULL AND role <> 'operator'`,
      [email],
    );

    if (user) {
      const token = newToken();
      /*
       * The invite has to NAME the thing it lets you into.
       *
       * This used to insert the role with all three subject ids left NULL, and it was
       * broken: `portal_invite_names_its_subject` requires a household invite to carry
       * a household_id, a provider invite a provider_id, and (since migration 0012) a
       * partner invite a partner_id. So typing your own email into this page raised a
       * constraint violation rather than sending a link — for households and providers
       * before 0012, and for every portal role after it.
       *
       * The ids come from the membership tables, and the WHERE refuses to issue a link
       * for a user whose role and membership disagree. In that case no row is written
       * and the page still says it has sent one, which is the same posture as an
       * unknown address: this form must not reveal which families use us.
       */
      await query(
        `INSERT INTO portal_invites
           (email, role, household_id, provider_id, partner_id,
            token_hash, issued_by, expires_at)
         SELECT u.email, u.role, hu.household_id, pu.provider_id, ru.partner_id,
                $2, 'self-service', now() + interval '15 minutes'
           FROM users u
           LEFT JOIN household_users hu ON hu.user_id = u.id
           LEFT JOIN provider_users pu ON pu.user_id = u.id
           LEFT JOIN partner_users ru ON ru.user_id = u.id
          WHERE u.id = $3
            AND ((u.role = 'household' AND hu.household_id IS NOT NULL)
              OR (u.role = 'provider'  AND pu.provider_id  IS NOT NULL)
              OR (u.role = 'partner'   AND ru.partner_id   IS NOT NULL))`,
        [email, hashToken(token), user.id],
      );
      const host = h.get('host') ?? 'localhost:3003';
      const proto = h.get('x-forwarded-proto') ?? 'http';

      /*
       * The outcome is deliberately not inspected. This page says the same thing to
       * every visitor, and a delivery failure is address-specific. Locally sendMail
       * prints the link because there is nowhere else for it to go; in a deployment it
       * is sent, and in neither case does it reach the server log.
       */
      await sendMail({
        to: email,
        subject: 'Your sign-in link',
        text:
          'Here is your link.\n\n'
          + `${proto}://${host}/invite/${token}\n\n`
          + 'It works once and expires after fifteen minutes. If you did not ask for it, '
          + 'nothing has happened and you can ignore this.',
      });
    }

    redirect('/login?sent=1');
  }

  return (
    <div className="wrap" style={{ maxWidth: '30rem', paddingBlock: '5rem' }}>
      <h1 style={{ fontSize: 'var(--step-2)' }}>Sign in</h1>

      {params.error === 'mail' ? (
        <p style={{ color: 'var(--crit)', fontSize: 'var(--step--1)' }}>
          Signing in is unavailable just now. Please call us and we will let you in by
          hand. Nothing is wrong with your account.
        </p>
      ) : null}

      {params.error === 'invite' ? (
        <p style={{ color: 'var(--crit)', fontSize: 'var(--step--1)' }}>
          That link is no longer valid. Links work once and expire after fifteen minutes.
        </p>
      ) : null}

      {params.sent ? (
        <p style={{
          border: '1px solid var(--line)', padding: '.85rem 1rem',
          fontSize: 'var(--step--1)', color: 'var(--ink-2)',
        }}>
          If that address has access, we have sent a link. It works once and expires
          after fifteen minutes.
        </p>
      ) : null}

      <form action={sendLink} style={{ marginTop: '1.5rem' }}>
        <label className="label" htmlFor="email">Your email</label>
        <input id="email" name="email" type="email" required autoComplete="email"
          style={{
            display: 'block', width: '100%', marginTop: '.35rem', padding: '.6rem .7rem',
            border: '1px solid var(--line-2)', borderRadius: '6px', font: 'inherit',
          }} />
        <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Send a sign-in link
        </button>
      </form>

      <p style={{ marginTop: '2rem', fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
        Access is by invitation. If you are arranging care for the first time, please
        call us instead.
      </p>
    </div>
  );
}
