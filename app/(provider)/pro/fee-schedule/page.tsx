import { redirect } from 'next/navigation';
import { getPortalSession } from '@/lib/session';
import { providerSelf } from '@/lib/pro';
import { EMBARGO_DAYS, feeSchedulesFor, hasFeeSchedule } from '@/lib/feeSchedule';
import { Prose, Section, Stack } from '@/components/layout';

export const dynamic = 'force-dynamic';

export default async function ProFeeSchedule() {
  const session = await getPortalSession();
  if (!session) redirect('/login');
  const me = await providerSelf(session);
  if (!me) redirect('/login');

  // § 1812.527 sits in Chapter 7, which governs nurses' registries. A CNA, HCA or
  // companion has no posted schedule, and an empty table would imply one is missing.
  if (!hasFeeSchedule(me.type)) {
    return (
      <Section title="Fee schedule" as="h1">
        <Prose>
          <p>
            The posted fee schedule is a requirement of the law covering nursing
            referrals, so it applies to registered and licensed vocational nurses. It
            does not apply to your work.
          </p>
          <p style={{ fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
            Our fee is charged to the household as a percentage of the job. Nothing is
            ever deducted from what you are paid, and there is no charge to you of any
            kind for being referred.
          </p>
        </Prose>
      </Section>
    );
  }

  const schedules = await feeSchedulesFor(session);
  const current = schedules.find((s) => s.inForce);
  /*
   * Split three ways rather than "current and everything else". A schedule that has
   * been posted but has not taken effect is the one thing on this page the seven-day
   * embargo exists for — it is the warning § 1812.527 requires — and listing it under
   * prior versions, below copy about what the terms used to be, buries exactly the
   * item a provider needs to act on.
   */
  const upcoming = schedules.filter((s) => s.upcoming);
  const prior = schedules.filter((s) => !s.inForce && !s.upcoming);

  return (
    <Stack gap="lg">
      <Section title="Fee schedule" as="h1">
        <Prose>
          <p>
            The law requires us to post this at least {EMBARGO_DAYS} days before it
            takes effect, so the terms cannot change under you partway through
            something. Both dates are below for every version.
          </p>
        </Prose>

        {current ? (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{
              border: '1px solid var(--line-2)', padding: '1.25rem',
              maxWidth: 'var(--measure)',
            }}>
              <p className="label" style={{ margin: 0 }}>In force &middot; version {current.version}</p>
              <p className="nums" style={{ fontSize: 'var(--step-1)', margin: '.4rem 0' }}>
                {current.maxFeePct}% maximum
              </p>
              <p style={{ margin: '0 0 .75rem', fontSize: 'var(--step--1)' }}>
                {current.paymentTerms}
              </p>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--step--1)' }}>{current.body}</p>

              <p className="label nums" style={{ marginTop: '1rem' }}>
                Posted {current.postedOn} &middot; effective {current.effectiveFrom}
                {' '}&middot; {current.noticeDays} days&rsquo; notice
              </p>

              {current.deliveredOn ? (
                <p style={{ marginTop: '.5rem', fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
                  We gave you this on <span className="nums">{current.deliveredOn}</span>
                  {current.deliveredBeforeInterview
                    ? ', before your interview, as the law requires.'
                    : '.'}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <Prose>
            <p>No schedule is in force yet. We will send you one before any interview.</p>
          </Prose>
        )}

        {upcoming.length > 0 ? (
          <div style={{ marginTop: '2rem' }}>
            <h2 style={{ fontSize: 'var(--step-0)' }}>Changing soon</h2>
            {upcoming.map((s) => (
              <div
                key={s.version}
                style={{
                  border: '1px solid var(--line-2)', borderLeftWidth: '3px',
                  padding: '1.1rem 1.25rem', maxWidth: 'var(--measure)',
                  marginTop: '.75rem',
                }}
              >
                <p className="label" style={{ margin: 0 }}>
                  Version {s.version} &middot; takes effect {s.effectiveFrom}
                </p>
                <p className="nums" style={{ fontSize: 'var(--step-0)', margin: '.35rem 0' }}>
                  {s.maxFeePct}% maximum &middot; {s.paymentTerms}
                </p>
                <p style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--step--1)' }}>{s.body}</p>
                <p className="label nums" style={{ marginTop: '.75rem' }}>
                  Posted {s.postedOn} &middot; {s.noticeDays} days&rsquo; notice
                </p>
                <p style={{ marginTop: '.5rem', fontSize: 'var(--step--1)', color: 'var(--ink-2)' }}>
                  Nothing changes for you until {s.effectiveFrom}. If you want to talk
                  about it before then, that is what the notice period is for.
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {prior.length > 0 ? (
          <div style={{ marginTop: '2rem' }}>
            <h2 style={{ fontSize: 'var(--step-0)' }}>Earlier versions</h2>
            <Prose>
              <p style={{ fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
                Every version we have given you, kept so you can always say what the
                terms were at the time rather than taking our word for what they are
                now. If one is missing, tell us — that is our record failing, not
                yours.
              </p>
            </Prose>
            <div className="scroller">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Version</th>
                    <th scope="col">Maximum</th>
                    <th scope="col">Posted</th>
                    <th scope="col">Effective</th>
                  </tr>
                </thead>
                <tbody>
                  {prior.map((s) => (
                    <tr key={s.version}>
                      <th scope="row" className="nums" style={{ fontWeight: 400 }}>{s.version}</th>
                      <td className="nums">{s.maxFeePct}%</td>
                      <td className="nums">{s.postedOn}</td>
                      <td className="nums">{s.effectiveFrom}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Section>
    </Stack>
  );
}
