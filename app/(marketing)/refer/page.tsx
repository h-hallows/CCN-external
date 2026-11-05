import type { Metadata } from 'next';
import { OPERATOR_NAME, contactLine } from '@/lib/brand';
import { PartnerReferralForm } from '@/components/PartnerReferralForm';
import { Prose, Section, Stack } from '@/components/layout';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Refer a patient',
  description:
    'For discharge planners, care managers and practices. One form, no account, and '
    + 'a call back from a named person.',
};

export default function Refer() {
  const line = contactLine();

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
        <PartnerReferralForm acknowledgedBy={OPERATOR_NAME} directLine={line || null} />
      </Section>
    </Stack>
  );
}
