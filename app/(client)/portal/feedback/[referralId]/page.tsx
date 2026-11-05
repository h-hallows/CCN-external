import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getPortalSession } from '@/lib/session';
import { feedbackSubject } from '@/lib/feedback';
import { ReferralFeedback } from '@/components/ReferralFeedback';
import { ALREADY } from '@/lib/feedbackState';
import { Prose, Section, Stack } from '@/components/layout';

export const dynamic = 'force-dynamic';

export default async function Feedback({
  params,
}: { params: Promise<{ referralId: string }> }) {
  const session = await getPortalSession();
  if (!session) redirect('/login');

  const { referralId } = await params;
  // Scoped to this household's own referrals. Somebody else's is not found.
  const subject = await feedbackSubject(session, referralId);
  if (!subject) notFound();

  return (
    <Stack gap="lg">
      <Section title="How did we do?" as="h1">
        <Link href="/portal/requests" style={{ fontSize: 'var(--step--1)' }}>
          &larr; Your requests
        </Link>
        <Prose>
          <p style={{ marginTop: '1rem' }}>
            We introduced you to {subject.providerName} on{' '}
            <span className="nums">{subject.referredOn}</span>. These two questions are
            about us — how well we read what you needed, and whether you would come
            back. They are not about {subject.providerName}.
          </p>
        </Prose>

        <div style={{ marginTop: '1.75rem' }}>
          {subject.answeredOn ? (
            <p style={{
              border: '1px solid var(--line-2)', padding: '.85rem 1rem',
              maxWidth: 'var(--measure)', fontSize: 'var(--step--1)', color: 'var(--ink-2)',
            }}>
              {ALREADY} You answered on <span className="nums">{subject.answeredOn}</span>.
            </p>
          ) : (
            <ReferralFeedback referralId={subject.referralId} />
          )}
        </div>
      </Section>
    </Stack>
  );
}
