import type { Metadata } from 'next';
import { OPERATOR_NAME, contactLine, publicMetadata } from '@/lib/brand';
import { PartnerReferralForm } from '@/components/PartnerReferralForm';
import { unstable_rethrow } from 'next/navigation';
import { getPortalSession } from '@/lib/session';
import { partnerIdentity } from '@/lib/partner';
import { Prose, Section, Stack } from '@/components/layout';

/*
 * Request-dependent again, and this time it genuinely is.
 *
 * An earlier pass made this page static on the grounds that nothing about it depended
 * on the request. Now the partner block is filled in from the signed-in partner's own
 * record, which depends on their cookie — and a statically rendered page has no cookie
 * in it, so without this the prefill would simply never appear in production while
 * working perfectly in development. Next says so by throwing during the build; the
 * catch below used to swallow that, which is how this would have shipped.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = publicMetadata({
  title: 'Refer a patient',
  description:
    'For discharge planners, care managers and practices. One form, no account, and '
    + 'a call back from a named person.',
});

export default async function Refer() {
  const line = contactLine();

  /*
   * A signed-in partner gets their own details filled in, and the form says their
   * referral will appear on their page. Anyone else sees the form exactly as before —
   * this is a public page and no account is needed for a first referral.
   *
   * Wrapped, because reading a session must never cost somebody the form: this page is
   * the front door for a discharge planner who has never heard of us.
   */
  let you = null;
  try {
    const session = await getPortalSession();
    you = session?.role === 'partner' ? await partnerIdentity(session) : null;
  } catch (err) {
    // Next signals redirects, notFound and dynamic-usage by throwing. Re-throw those
    // first: a catch that keeps them turns the framework's control flow into a log
    // line, which is exactly how the static-rendering bug above got as far as it did.
    unstable_rethrow(err);
    console.error('[refer] could not read the session; showing the blank form', err);
  }

  return (
    <Stack gap="lg">
      <Section title="Refer a patient" as="h1">
        <Prose>
          <p style={{ fontSize: 'var(--step-1)', color: 'var(--ink-2)' }}>
            One form, no account, and a call back from a named person. If it is
            urgent, the phone is faster and we would rather you used it.
          </p>
          <p>
            We will call the family, not you, and then come back to you with who we
            spoke to and when. If we cannot help — wrong area, wrong level of care,
            nobody available — we will tell you that quickly rather than sit on it.
          </p>
          {/*
            * § 0.1 and § 1812.531. Saying this plainly on the form itself is the
            * point: a discharge planner at a hospital needs to know there is nothing
            * to disclose, and a planner who has been offered something elsewhere needs
            * to know why we are different.
            */}
          <p>
            There is no payment of any kind for a referral, in either direction. We do
            not pay for referrals and we never will — a nurses&rsquo; registry is
            forbidden from sharing fees with a physician, hospital or their staff, and
            we would rather build this on being useful. Nothing here is a commission,
            a rebate or a rewards scheme, and there is nowhere in our records to put
            one.
          </p>
        </Prose>
      </Section>

      <Section title="The form" as="h2">
        <PartnerReferralForm acknowledgedBy={OPERATOR_NAME} directLine={line || null} you={you} />
      </Section>
    </Stack>
  );
}
