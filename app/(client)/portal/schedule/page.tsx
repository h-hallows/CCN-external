import { redirect } from 'next/navigation';
import { getPortalSession } from '@/lib/session';
import { BLOCKS, BLOCK_LABEL, DAYS, byDay, caseSchedules } from '@/lib/schedule';
import { Prose, Section, Stack } from '@/components/layout';

export const dynamic = 'force-dynamic';

const CARE_LABEL: Record<string, string> = {
  companion: 'Companionship',
  personal_care: 'Personal care',
  skilled_nursing: 'Skilled nursing',
  post_surgical: 'Post-surgical recovery',
  overnight_newborn: 'Overnight newborn care',
  respite: 'Respite',
  hospice_support: 'Hospice support',
};

export default async function Schedule() {
  const session = await getPortalSession();
  if (!session) redirect('/login');
  const schedules = await caseSchedules(session);
  const withPattern = schedules.filter((s) => s.pattern.length > 0);

  if (withPattern.length === 0) {
    return (
      <Section title="Your schedule" as="h1">
        <Prose>
          <p>Your schedule will appear here once care starts.</p>
        </Prose>
      </Section>
    );
  }

  return (
    <Stack gap="lg">
      {withPattern.map((s) => {
        const grid = byDay(s.pattern);
        return (
          <Section
            key={s.caseId}
            label={CARE_LABEL[s.care] ?? s.care}
            title="Your schedule"
            as="h1"
          >
            {/*
              * The pattern as asked for, not a roster. Nothing here allocates a shift
              * or assigns anybody: the registry records what the household asked for
              * and what the provider said they are open to, and an operator arranges
              * cover by telephone. Generating it would be work direction — I2.
              */}
            <div className="scroller" style={{ marginTop: '1.25rem' }}>
              <table style={{ minWidth: '34rem' }}>
                <thead>
                  <tr>
                    <th scope="col">&nbsp;</th>
                    {DAYS.map((d) => <th key={d} scope="col">{d}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {BLOCKS.map((block) => (
                    <tr key={block}>
                      <th scope="row">{BLOCK_LABEL[block] ?? block}</th>
                      {DAYS.map((day) => (
                        <td key={day} style={{ textAlign: 'center' }}>
                          {grid.get(day)?.has(block)
                            ? <span aria-label="covered">&#9679;</span>
                            : <span style={{ color: 'var(--line-2)' }} aria-hidden>&ndash;</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Prose>
              <p style={{ marginTop: '1rem', fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
                {s.hoursPerWeek ? <>About {s.hoursPerWeek} hours a week. </> : null}
                {s.startsOn ? <>Starting <span className="nums">{s.startsOn}</span>.</> : null}
              </p>
            </Prose>

            <div style={{ marginTop: '1.5rem' }}>
              <h2 style={{ fontSize: 'var(--step-0)' }}>Who is covering</h2>
              <Prose>
                {s.primary ? (
                  <p>{s.primary} is the person you will usually see.</p>
                ) : (
                  <p>Nobody is set as your regular yet. We will call you about that.</p>
                )}
                {s.alternates.length > 0 ? (
                  <p style={{ color: 'var(--ink-2)' }}>
                    {s.alternates.join(' and ')}{' '}
                    {s.alternates.length === 1 ? 'has' : 'have'} agreed to cover when
                    they cannot. You can read about anyone here before they arrive.
                  </p>
                ) : (
                  <p style={{ color: 'var(--ink-2)' }}>
                    We are still arranging named cover for the days your regular cannot
                    make. We aim for two people you have met.
                  </p>
                )}
              </Prose>
            </div>

            {s.gaps.length > 0 ? (
              <div style={{ marginTop: '1.5rem' }}>
                <h2 style={{ fontSize: 'var(--step-0)' }}>The next thirty days</h2>
                <Prose>
                  <ul className="nums">
                    {s.gaps.map((g) => (
                      <li key={`${g.onDate}-${g.block}`}>
                        {g.onDate}, {(BLOCK_LABEL[g.block] ?? g.block).toLowerCase()} —{' '}
                        {g.coveredBy
                          ? <>{g.coveredBy} is covering.</>
                          : <>we&rsquo;re arranging cover.</>}
                        {g.note ? <span style={{ color: 'var(--ink-3)' }}> {g.note}</span> : null}
                      </li>
                    ))}
                  </ul>
                  <p style={{ fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
                    We flag these as soon as we know, rather than when we have solved
                    them. If a date matters more than the others, tell us and we will
                    start there.
                  </p>
                </Prose>
              </div>
            ) : null}
          </Section>
        );
      })}
    </Stack>
  );
}
