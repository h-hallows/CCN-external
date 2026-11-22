import Link from 'next/link';
import type { Metadata } from 'next';
import { contactLine, contactResolved, publicMetadata } from '@/lib/brand';
import { EnquiryForm } from '@/components/EnquiryForm';
import { Prose, Section, Stack } from '@/components/layout';

/*
 * The form reads the path it was reached from, so this is request-dependent. Static
 * would prerender one source value into every enquiry and quietly make the attribution
 * figure wrong rather than absent, which is worse.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = publicMetadata({
  title: 'Arrange care',
  description:
    'Tell us what is needed and we will call you back. We put forward the two or three '
    + 'people who fit — you engage them directly.',
}, '/enquire');

/**
 * The household's door.
 *
 * `/api/inquiry` has been deployed, validated and rate-limited since the front door
 * went in, and nothing called it. This page is what makes the marketing site a way of
 * reaching us rather than a description of a business.
 */
export default function Enquire({
  searchParams,
}: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <Body searchParams={searchParams} />;
}

async function Body({
  searchParams,
}: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  /*
   * A crossed landing page links here with the service it is about already chosen, so
   * somebody who read a page about post-surgical care in Beverly Hills does not pick it
   * out of a list again. A prefill, not a lock: the select is still a select.
   */
  const params = (await searchParams) ?? {};
  const care = typeof params.care === 'string' ? params.care : undefined;
  const line = contactLine();

  return (
    <Stack gap="lg">
      <Section title="Arrange care" as="h1">
        <Prose>
          <p style={{ fontSize: 'var(--step-1)', color: 'var(--ink-2)' }}>
            Tell us what is needed. We will call you back, ask the questions that
            actually decide it, and put forward the two or three people who fit.
          </p>
          <p>
            A few lines is enough to start. We would rather have four fields and a
            phone number today than a complete form next week.
          </p>
          {contactResolved() ? (
            <p>
              If it is urgent, call us on {line} — someone will pick up, and the
              phone is faster than this.
            </p>
          ) : null}
        </Prose>
      </Section>

      <Section title="What happens next" as="h2">
        <Prose>
          <ol>
            <li>We call you, usually within the hour if you are discharging today.</li>
            <li>
              We go through what the days look like — who is around, what has been
              tried, what the hard part is.
            </li>
            <li>
              We put forward the people who fit, with their rate and what they have
              actually done. You meet them.
            </li>
            <li>
              You engage whoever you choose, directly, and agree the rate with them.
              We stay reachable when something changes.
            </li>
          </ol>
          <p style={{ color: 'var(--ink-2)' }}>
            We are a referral registry, not an agency that sends staff. The provider is
            referred to you and the working relationship is yours and theirs.{' '}
            <Link href="/how-it-works">What that means in practice</Link>.
          </p>
        </Prose>
      </Section>

      <Section title="Tell us what is needed" as="h2">
        <EnquiryForm careType={care} />
      </Section>
    </Stack>
  );
}
