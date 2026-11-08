/**
 * The partner referral form. No account needed for a first referral — spec § 11.
 *
 * Writes to `inquiries` with the partner block in `referrer`. The person we will call
 * is the family contact; the partner's own details are recorded so the acknowledgement
 * can reach a named person.
 */
import type { NextRequest } from 'next/server';
import { PartnerReferralSchema } from '@/lib/schemas/intake';
import { recordPartnerReferral } from '@/lib/intake';
import { rateLimit } from '@/lib/rateLimit';
import { notifyOperator } from '@/lib/notify';
import { unstable_rethrow } from 'next/navigation';
import { getPortalSession, type PortalSession } from '@/lib/session';
import { accepted, failed, limited, readBody, rejected, silentlyDropped } from '@/lib/intakeResponse';

export const dynamic = 'force-dynamic';

/**
 * The partner sending this, if one is signed in. Null for everyone else.
 *
 * Wrapped, and the wrapping is the point: attribution is an enhancement on a public
 * endpoint, and failing to read a session must not cost somebody their referral. It
 * also fails in the safe direction — `partner_id` is what grants the right to read an
 * outcome later, so not setting it withholds access rather than granting it.
 *
 * Loud, because the quiet version of this failure is a partner whose portal says
 * "nothing yet" for weeks while their referrals arrive unattributed.
 */
async function signedInPartner(): Promise<PortalSession | null> {
  try {
    const session = await getPortalSession();
    return session?.role === 'partner' ? session : null;
  } catch (err) {
    // Next's own control flow is never a session failure. Re-thrown before anything
    // here decides what the error meant.
    unstable_rethrow(err);
    console.error(
      '[refer] could not read the session; recording this referral unattributed, '
      + 'so it will not appear in any partner\'s portal until an operator attaches it',
      err,
    );
    return null;
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  if (await rateLimit(request, { key: 'refer', max: 10, windowSec: 600 })) return limited();

  const parsed = PartnerReferralSchema.safeParse(await readBody(request));
  if (!parsed.success) return rejected(parsed.error);
  if (parsed.data.honeypot) return silentlyDropped();

  /*
   * If a partner is signed in, the referral is theirs and the portal will show it.
   * The session is the only thing that decides that — never the email in the form, or
   * anyone could claim another partner's referrals by knowing their address.
   *
   * A session belonging to a household or a provider is ignored here rather than
   * refused: the form is public, and somebody signed in to their own family's screen
   * passing a neighbour's details on is a perfectly ordinary thing to do.
   */
  const partner = await signedInPartner();

  let reference: string;
  try {
    reference = await recordPartnerReferral(parsed.data, partner);
  } catch (err) {
    console.error('[refer] could not record', err);
    return failed();
  }

  await notifyOperator({
    kind: 'partner_referral',
    urgency: parsed.data.urgency,
    subject: `Partner referral (${parsed.data.urgency.replace('_', ' ')})`,
    body: 'A referral has arrived from a partner. Open the console to see it.',
    payload: {
      inquiryId: reference,
      partnerRole: parsed.data.partnerRole,
      urgency: parsed.data.urgency,
      // So the console can say whether it needs attaching to a partner by hand.
      attributed: Boolean(partner),
    },
  });

  return accepted(
    parsed.data.urgency === 'discharge' || parsed.data.urgency === 'same_day'
      ? 'Received. We will call them today and come back to you with who we spoke to.'
      : 'Received. We will call them and come back to you with who we spoke to.',
    reference,
  );
}
