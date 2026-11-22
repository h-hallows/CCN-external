import Link from 'next/link';
import type { Metadata } from 'next';
import { publicMetadata } from '@/lib/brand';
import { ProviderApplicationForm } from '@/components/ProviderApplicationForm';
import { Prose, Section, Stack } from '@/components/layout';

export const metadata: Metadata = publicMetadata({
  title: 'Apply to be referred',
  description:
    'For experienced nurses and caregivers in West Los Angeles. You set your rate, you '
    + 'choose what you take, and you are never charged a fee.',
}, '/apply');

/**
 * The provider's door.
 *
 * `/for-providers` has always explained how referrals work here — rates, declining,
 * what is never asked of anybody — and ended without a way to apply. `/api/apply` was
 * deployed and unreachable. The page is the argument; this is the door at the end of it.
 */
export default function Apply() {
  return (
    <Stack gap="lg">
      <Section title="Apply to be referred" as="h1">
        <Prose>
          <p style={{ fontSize: 'var(--step-1)', color: 'var(--ink-2)' }}>
            We keep a small roster of experienced nurses and caregivers in West Los
            Angeles. If we refer you to a household, you set your own rate, you decide
            what you take, and you are never charged a fee of any kind.
          </p>
          <p>
            There is no account to create and no test to sit. A person reads every
            application.{' '}
            <Link href="/for-providers">What working through us is actually like</Link>.
          </p>
        </Prose>
      </Section>

      <Section title="What happens after you send it" as="h2">
        <Prose>
          <ol>
            <li>Somebody reads it. If it looks like a fit, we call you.</li>
            <li>
              We verify your credentials against the body that issued them — the Board
              of Registered Nursing, the BVNPT, the CDPH registry — and we look at the
              licence itself. You cannot set your own expiry date or verification
              status in our records, and that is what makes them worth anything to the
              households who rely on them.
            </li>
            <li>
              A background check through the California Department of Justice, and we
              confirm your experience in writing.
            </li>
            <li>
              After that you are on the roster, and we come to you when there is work
              that matches what you said you would take.
            </li>
          </ol>
        </Prose>
      </Section>

      <Section title="What we will never ask you for" as="h2">
        <Prose>
          <p>
            A fee, in any direction or under any name. Coursework or continuing
            education. A skills test. Anything to wear, anything to pin on, or equipment
            to buy. An app to clock into. A list of things to tick off at a household.
          </p>
          <p>
            There is no acceptance rate here, no response-time target and no ranking.
            How often you say no is not recorded anywhere, because the field was never
            built.
          </p>
        </Prose>
      </Section>

      <Section title="Your application" as="h2">
        <ProviderApplicationForm />
      </Section>
    </Stack>
  );
}
