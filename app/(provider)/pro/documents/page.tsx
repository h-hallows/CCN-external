import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PROVIDER_NOTICE, isDeliverable } from '@/content/statutory';
import { getPortalSession } from '@/lib/session';
import { providerSelf } from '@/lib/pro';
import { feeSchedulesFor, hasFeeSchedule } from '@/lib/feeSchedule';
import { Prose, Section, Stack } from '@/components/layout';

export const dynamic = 'force-dynamic';

/**
 * § 4.2 /pro/documents — the signed referral agreement, the § 1812.5095(d) notice, and
 * for nurses the fee schedule as provided before the interview.
 *
 * Two of those three are dates rather than files. `providers.agreement_signed_on` and
 * `written_notice_ack_on` record that a thing happened and when; nothing in this system
 * stores a document of any kind, and the architecture spec's § 9 schema additions do
 * not include one. The screen says so rather than showing an empty list that reads as
 * "you have no documents".
 *
 * The § 1812.5095(d) text itself IS available, because it lives in content/statutory
 * and is the same text that was handed over. A provider who wants to re-read what they
 * acknowledged should not have to ask for it.
 */
export default async function ProDocuments() {
  const session = await getPortalSession();
  if (!session) redirect('/login');
  const me = await providerSelf(session);
  if (!me) redirect('/login');

  const schedules = hasFeeSchedule(me.type) ? await feeSchedulesFor(session) : [];
  const beforeInterview = schedules.find((s) => s.deliveredBeforeInterview);

  return (
    <Stack gap="lg">
      <Section title="What we have given you" as="h1">
        <Prose>
          <p>
            The law sets out certain things we have to put in front of you, and by
            when. This is our record of that, so you can check it rather than take our
            word for it.
          </p>
        </Prose>
      </Section>

      <Section title="Your referral agreement" as="h2">
        <Prose>
          <p>
            {me.agreementSignedOn ? (
              <>
                You signed it on <span className="nums">{me.agreementSignedOn}</span>.
                It sets out that we refer work and do not employ you, that you set your
                own rate, and that you decide what you take.
              </>
            ) : (
              <>
                We have no record of a signed agreement. That should exist before you
                are referred anywhere, so tell us and we will sort it out.
              </>
            )}
          </p>
        </Prose>
      </Section>

      <Section title="The notice we gave you" as="h2">
        <Prose>
          <p>
            {me.writtenNoticeAckOn ? (
              <>
                You acknowledged it on{' '}
                <span className="nums">{me.writtenNoticeAckOn}</span>.
              </>
            ) : (
              <>We have no record of you acknowledging this one yet.</>
            )}
          </p>
          <p style={{ fontSize: 'var(--step--1)', color: 'var(--ink-2)' }}>
            {PROVIDER_NOTICE.citation} &middot; version {PROVIDER_NOTICE.VERSION}
          </p>
        </Prose>
        {/*
          * Only when counsel stands behind the wording. § 1812.5095(d) is currently
          * drafted but not approved, and showing a provider a draft as though it were
          * the notice they acknowledged is worse than showing nothing — they have no
          * way to tell which they are reading.
          */}
        {isDeliverable(PROVIDER_NOTICE) ? (
          <details style={{ marginTop: '.75rem', maxWidth: 'var(--measure)' }}>
            <summary style={{ cursor: 'pointer', fontSize: 'var(--step--1)' }}>Read it</summary>
            <div
              className="statutory"
              style={{
                marginTop: '.75rem', padding: '1rem', border: '1px solid var(--line)',
                background: 'var(--surface)', whiteSpace: 'pre-wrap',
                fontSize: 'var(--step--1)',
              }}
            >
              {PROVIDER_NOTICE.text}
            </div>
          </details>
        ) : (
          <p style={{
            marginTop: '.75rem', padding: '.8rem 1rem', maxWidth: 'var(--measure)',
            border: '1px solid var(--line-2)', fontSize: 'var(--step--1)',
            color: 'var(--ink-2)',
          }}>
            The wording is still with our lawyers, so we are not reprinting it here —
            you would have no way of telling a draft from the final version. Ask us for
            a copy of what you signed and we will send it.
          </p>
        )}
      </Section>

      {hasFeeSchedule(me.type) ? (
        <Section title="Your fee schedule" as="h2">
          <Prose>
            <p>
              {beforeInterview ? (
                <>
                  We gave you version {beforeInterview.version} on{' '}
                  <span className="nums">{beforeInterview.deliveredOn}</span>, before
                  your interview, which is when the law requires it.
                </>
              ) : (
                <>
                  We have not recorded giving you a fee schedule before an interview.
                  If you had one, tell us — that is our record failing, not yours.
                </>
              )}
            </p>
            <p>
              <Link href="/pro/fee-schedule">See every version in full</Link>.
            </p>
          </Prose>
        </Section>
      ) : null}

      <Section title="Not here yet" as="h2">
        <Prose>
          <p style={{ fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
            We do not yet store the signed agreement itself as a file you can download,
            only the fact and date of it. Ask us for a copy and we will send it while
            we build that part.
          </p>
        </Prose>
      </Section>
    </Stack>
  );
}
