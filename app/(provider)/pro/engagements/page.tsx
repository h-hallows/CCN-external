import { redirect } from 'next/navigation';
import { getPortalSession } from '@/lib/session';
import { AREA_LABEL, CARE_LABEL, engagements } from '@/lib/opportunities';
import { Prose, Section, Stack } from '@/components/layout';

export const dynamic = 'force-dynamic';

/**
 * § 4.2 /pro/engagements — current and past, hours, and the household profile document
 * for each.
 *
 * The household profile is the point of this screen. It is what the family wrote about
 * the routine, the access and what matters at 3am, and it travels with the work so a
 * substitute arriving at seven in the morning is not starting from nothing.
 */
const OUTCOME_WORDS: Record<string, string> = {
  engaged: 'You worked with this household',
  declined_by_household: 'The household went another way',
  declined_by_provider: 'You said no to this one',
  no_response: 'This one did not go anywhere',
};

export default async function ProEngagements() {
  const session = await getPortalSession();
  if (!session) redirect('/login');
  const all = await engagements(session);

  if (all.length === 0) {
    return (
      <Section title="Work you have been put forward for" as="h1">
        <Prose>
          <p>
            Nothing yet. When a household asks for you we will put it here and ring
            you about it.
          </p>
        </Prose>
      </Section>
    );
  }

  const current = all.filter((e) => e.outcome === 'engaged' && !e.endedOn);
  const rest = all.filter((e) => !(e.outcome === 'engaged' && !e.endedOn));

  return (
    <Stack gap="lg">
      {current.length > 0 ? (
        <Section title="Where you are working now" as="h1">
          {current.map((e) => (
            <article
              key={e.referralId}
              style={{
                border: '1px solid var(--line-2)', padding: '1.25rem',
                maxWidth: 'var(--measure)', marginTop: '1rem',
              }}
            >
              <h2 style={{ fontSize: 'var(--step-0)', margin: 0 }}>
                {CARE_LABEL[e.care] ?? e.care}
                {e.area ? <> in {AREA_LABEL[e.area] ?? e.area}</> : null}
              </h2>
              <p style={{ margin: '.35rem 0 0', fontSize: 'var(--step--1)', color: 'var(--ink-2)' }}>
                {e.hoursPerWeek ? <>About {e.hoursPerWeek} hours a week. </> : null}
                {e.startsOn ? <>Since <span className="nums">{e.startsOn}</span>.</> : null}
              </p>

              {e.householdProfile ? (
                <div style={{ marginTop: '1.1rem' }}>
                  <p className="label" style={{ margin: '0 0 .35rem' }}>
                    What the household wants you to know
                  </p>
                  <p style={{
                    margin: 0, whiteSpace: 'pre-wrap', fontSize: 'var(--step--1)',
                    lineHeight: 1.7,
                  }}>
                    {e.householdProfile}
                  </p>
                </div>
              ) : (
                <p style={{ marginTop: '1.1rem', fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
                  The household has not written anything about their routine yet.
                </p>
              )}
            </article>
          ))}
        </Section>
      ) : null}

      <Section
        title={current.length > 0 ? 'Everything else' : 'Work you have been put forward for'}
        as={current.length > 0 ? 'h2' : 'h1'}
      >
        <div style={{ marginTop: '1rem' }}>
          {rest.map((e) => (
            <article
              key={e.referralId}
              style={{
                borderTop: '1px solid var(--line)', paddingBlock: '1.1rem',
                maxWidth: 'var(--measure)',
              }}
            >
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '.4rem 1rem', alignItems: 'baseline',
              }}>
                <h3 style={{ fontSize: 'var(--step-0)', margin: 0 }}>
                  {CARE_LABEL[e.care] ?? e.care}
                  {e.area ? <> in {AREA_LABEL[e.area] ?? e.area}</> : null}
                </h3>
                <span className="label nums" style={{ marginLeft: 'auto' }}>
                  {e.referredOn}
                </span>
              </div>
              <p style={{ margin: '.3rem 0 0', fontSize: 'var(--step--1)', color: 'var(--ink-2)' }}>
                {e.outcome
                  ? OUTCOME_WORDS[e.outcome] ?? e.outcome
                  : e.answeredOn
                    ? 'You have answered; we are arranging the rest'
                    : 'Waiting on your answer'}
                {e.endedOn ? <> &middot; ended <span className="nums">{e.endedOn}</span></> : null}
              </p>
            </article>
          ))}
        </div>

        <Prose>
          <p style={{ marginTop: '1.5rem', fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
            We keep this list so you have your own record of the work, not so anyone can
            read anything into it. There is no count of how often you said no and
            nothing here affects what we put you forward for next.
          </p>
        </Prose>
      </Section>
    </Stack>
  );
}
