import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPortalSession } from '@/lib/session';
import { credentialStanding, providerSelf } from '@/lib/pro';
import { hasFeeSchedule } from '@/lib/feeSchedule';
import {
  AREA_LABEL, CARE_LABEL, currentOpportunities,
} from '@/lib/opportunities';
import { OpportunityAnswer } from '@/components/OpportunityAnswer';
import { BLOCK_LABEL } from '@/lib/pro';
import { Prose, Section, Stack } from '@/components/layout';

/** 'Mon:AM' as a sentence, so an opportunity reads rather than decodes. */
function pattern(slots: string[]): string {
  if (slots.length === 0) return 'Pattern not set yet';
  const byBlock = new Map<string, string[]>();
  for (const s of slots) {
    const [day, block] = s.split(':');
    if (!day || !block) continue;
    byBlock.set(block, [...(byBlock.get(block) ?? []), day]);
  }
  return [...byBlock.entries()]
    .map(([block, days]) => `${(BLOCK_LABEL[block] ?? block).toLowerCase()}s ${days.join(', ')}`)
    .join('; ');
}

export const dynamic = 'force-dynamic';

export default async function ProHome() {
  const session = await getPortalSession();
  if (!session) redirect('/login');
  const me = await providerSelf(session);
  if (!me) redirect('/login');
  const standing = await credentialStanding(session);
  const opportunities = await currentOpportunities(session);

  const blocking = standing?.blocking ?? [];
  const labels = standing?.credentials
    .filter((c) => blocking.includes(c.type))
    .map((c) => c.label) ?? [];

  return (
    <Stack gap="lg">
      <Section title={`Hello, ${me.preferredName ?? me.fullName}`} as="h1">
        {/*
          * Where they stand and what to do about it. Deliberately not a dashboard:
          * no acceptance rate, no response time, no score, no ranking, no streak.
          * I1, I2 and § 687.2(d)–(e) — a provider who is measured is being managed.
          */}
        <Prose>
          {standing?.eligible ? (
            <p>
              Everything we need is on file, so we can put you forward. Keep your rate
              and your availability as you want them and we will work from those.
            </p>
          ) : labels.length > 0 ? (
            <>
              <p>
                We cannot put you forward at the moment because we are missing{' '}
                {labels.join(', ')}. That is the only thing standing in the way.
              </p>
              <p>
                <Link href="/pro/credentials">Send it to us</Link> and we will check it
                against the body that issued it.
              </p>
            </>
          ) : (
            <p>
              Your record is with us. If anything is needed we will say so here and ring
              you — we will not simply stop putting you forward without telling you.
            </p>
          )}
        </Prose>
      </Section>

      {/*
        * Opportunities, § 4.2. No countdown, no "expires in", no colour that changes
        * with time and no ordering that implies urgency — the date it was referred is
        * a fact and nothing here pushes. A test asserts the absence across this tree.
        */}
      {opportunities.length > 0 ? (
        <Section title={opportunities.length === 1 ? 'Someone has asked for you' : 'People have asked for you'} as="h2">
          <Prose>
            <p style={{ color: 'var(--ink-2)' }}>
              Take as long as you need. If you would rather talk it through before
              answering, call us and we will go through it.
            </p>
          </Prose>

          <div style={{ marginTop: '1.5rem' }}>
            {opportunities.map((o) => (
              <article
                key={o.referralId}
                style={{
                  borderTop: '1px solid var(--line)', paddingBlock: '1.5rem',
                  maxWidth: 'var(--measure)',
                }}
              >
                <h3 style={{ fontSize: 'var(--step-0)', margin: 0 }}>
                  {CARE_LABEL[o.care] ?? o.care}
                  {o.area ? <> in {AREA_LABEL[o.area] ?? o.area}</> : null}
                </h3>

                <p style={{ margin: '.4rem 0 0', fontSize: 'var(--step--1)', color: 'var(--ink-2)' }}>
                  {pattern(o.pattern)}
                  {o.hoursPerWeek ? <> &middot; about {o.hoursPerWeek} hours a week</> : null}
                  {o.startsOn ? <> &middot; from <span className="nums">{o.startsOn}</span></> : null}
                </p>

                {o.needs ? (
                  <div style={{ marginTop: '.85rem' }}>
                    <p className="label" style={{ margin: '0 0 .3rem' }}>
                      What the household told us
                    </p>
                    {/* Their words from intake, shown as written. Nothing generates or
                        summarises this — I10. */}
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 'var(--step--1)' }}>
                      {o.needs}
                    </p>
                  </div>
                ) : null}

                <p className="label nums" style={{ marginTop: '.85rem' }}>
                  Referred {o.referredOn}
                </p>

                {o.answeredOn ? (
                  /* Rendered from the database, so a router refresh after the action
                     cannot take the acknowledgement away with it. */
                  <p style={{
                    marginTop: '1.1rem', padding: '.8rem 1rem',
                    border: '1px solid var(--line-2)', fontSize: 'var(--step--1)',
                    color: 'var(--ink-2)',
                  }}>
                    You answered this on <span className="nums">{o.answeredOn}</span>.
                    We will take it from here — if you have changed your mind, call us.
                  </p>
                ) : (
                  <OpportunityAnswer referralId={o.referralId} />
                )}
              </article>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Your record" as="h2">
        <Prose>
          <ul>
            <li><Link href="/pro/profile">About you</Link> — what households read first</li>
            <li>
              <Link href="/pro/rate">Your rate</Link>
              {me.rateHourly
                ? <> — <span className="nums">${Number(me.rateHourly).toFixed(0)}</span> an hour, negotiable</>
                : <> — not set, which is a fine answer</>}
            </li>
            <li>
              <Link href="/pro/availability">When you work</Link>
              {me.availability.length > 0
                ? <> — {me.availability.length} {me.availability.length === 1 ? 'slot' : 'slots'} a week</>
                : <> — nothing set yet</>}
            </li>
            <li><Link href="/pro/limits">What you will not take on</Link></li>
            <li><Link href="/pro/credentials">Documents you have sent us</Link></li>
            <li><Link href="/pro/engagements">Work you have been put forward for</Link></li>
            <li><Link href="/pro/documents">What we have given you</Link></li>
            <li><Link href="/pro/resume">Your résumé</Link> — yours to use anywhere</li>
            {hasFeeSchedule(me.type) ? (
              <li><Link href="/pro/fee-schedule">Fee schedule</Link></li>
            ) : null}
          </ul>
        </Prose>
      </Section>
    </Stack>
  );
}
