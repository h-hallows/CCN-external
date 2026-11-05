import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPortalSession } from '@/lib/session';
import { householdRequests, REQUEST_STATUS } from '@/lib/request';
import { Prose, Section, Stack } from '@/components/layout';

export const dynamic = 'force-dynamic';

export default async function Requests() {
  const session = await getPortalSession();
  if (!session) redirect('/login');
  const requests = await householdRequests(session);

  if (requests.length === 0) {
    return (
      <Section title="Your requests" as="h1">
        <Prose>
          <p>
            When you ask us about someone on your short list, it will appear here with
            where it has got to.
          </p>
        </Prose>
      </Section>
    );
  }

  return (
    <Stack gap="lg">
      <Section title="Your requests" as="h1">
        <Prose>
          <p style={{ color: 'var(--ink-2)' }}>
            Everything you have asked us about, and where each one stands. We will
            always have spoken to you before making an introduction.
          </p>
        </Prose>

        <div style={{ marginTop: '1.5rem' }}>
          {requests.map((r) => {
            const status = REQUEST_STATUS[r.status]
              ?? { label: r.status, detail: '' };
            return (
              <article
                key={r.requestId}
                style={{
                  borderTop: '1px solid var(--line)',
                  paddingBlock: '1.1rem',
                  maxWidth: 'var(--measure)',
                }}
              >
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '.5rem 1rem',
                  alignItems: 'baseline',
                }}>
                  <h2 style={{ fontSize: 'var(--step-0)', margin: 0 }}>{r.providerName}</h2>
                  <span className="label nums" style={{ marginLeft: 'auto' }}>
                    {r.requestedOn}
                  </span>
                </div>

                <p style={{ margin: '.35rem 0 0', fontSize: 'var(--step--1)' }}>
                  <strong style={{ fontWeight: 600 }}>{status.label}</strong>
                  {status.detail ? <> — {status.detail}</> : null}
                </p>

                {r.note ? (
                  <p style={{
                    margin: '.5rem 0 0', fontSize: 'var(--step--1)', color: 'var(--ink-3)',
                  }}>
                    You told us: {r.note}
                  </p>
                ) : null}

                {r.referralId ? (
                  <p style={{ margin: '.6rem 0 0', fontSize: 'var(--step--1)' }}>
                    <Link href={`/portal/feedback/${r.referralId}`}>
                      Tell us how we did
                    </Link>
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </Section>
    </Stack>
  );
}
