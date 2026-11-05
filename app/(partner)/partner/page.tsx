import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPortalSession } from '@/lib/session';
import { OUTCOME_NOTE, partnerReferrals, referralStanding } from '@/lib/partner';
import { contactLine, OPERATOR_NAME } from '@/lib/brand';
import { CARE_LABEL, AREA_LABEL } from '@/lib/opportunities';
import { Prose, Section, Stack } from '@/components/layout';

export const dynamic = 'force-dynamic';

const URGENCY_LABEL: Record<string, string> = {
  discharge: 'Discharging', same_day: 'Same day',
  next_day: 'Next day', routine: 'Routine',
};

export default async function PartnerView() {
  const session = await getPortalSession();
  if (!session) redirect('/login');
  const referrals = await partnerReferrals(session);
  const line = contactLine();

  return (
    <Stack gap="lg">
      <Section title="What you have sent us" as="h1">
        <Prose>
          {referrals.length === 0 ? (
            <p>
              Nothing yet. When you{' '}
              <Link href="/refer">send us a patient</Link> it will appear here with
              where it has got to.
            </p>
          ) : (
            <p style={{ color: 'var(--ink-2)' }}>
              Every referral you have sent, and where each one stands.
            </p>
          )}
        </Prose>

        {referrals.length > 0 ? (
          <div style={{ marginTop: '1.5rem' }}>
            {referrals.map((r) => (
              <article
                key={r.inquiryId}
                style={{
                  borderTop: '1px solid var(--line)', paddingBlock: '1.1rem',
                  maxWidth: 'var(--measure)',
                }}
              >
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '.4rem 1rem', alignItems: 'baseline',
                }}>
                  <h2 style={{ fontSize: 'var(--step-0)', margin: 0 }}>
                    {/* Initials, never a name. That is all we asked for and all we keep. */}
                    {r.patientInitials ?? 'A patient'}
                    {r.careType ? <> &middot; {CARE_LABEL[r.careType] ?? r.careType}</> : null}
                  </h2>
                  <span className="label nums" style={{ marginLeft: 'auto' }}>
                    {r.receivedOn}
                  </span>
                </div>

                <p style={{ margin: '.3rem 0 0', fontSize: 'var(--step--1)', color: 'var(--ink-2)' }}>
                  {r.area ? <>{AREA_LABEL[r.area] ?? r.area}</> : null}
                  {r.urgency ? <> &middot; {URGENCY_LABEL[r.urgency] ?? r.urgency}</> : null}
                  {' '}&middot; we call {r.contactName}
                </p>

                <p style={{ margin: '.35rem 0 0', fontSize: 'var(--step--1)' }}>
                  <strong style={{ fontWeight: 600 }}>{referralStanding(r)}</strong>
                  {r.acknowledgedOn ? (
                    <span style={{ color: 'var(--ink-3)' }}>
                      {' '}&middot; <span className="nums">{r.acknowledgedOn}</span>
                    </span>
                  ) : null}
                </p>
              </article>
            ))}
          </div>
        ) : null}
      </Section>

      <Section title="What we can and cannot tell you" as="h2">
        <Prose>
          <p>{OUTCOME_NOTE}</p>
          {/*
            * § 0.1 and § 1812.531, said again where somebody signed in will read it.
            * The partner programme is a convenience and a service and nothing else.
            */}
          <p>
            There is no payment attached to any of this, in either direction, and there
            is nowhere in our records to record one. A nurses&rsquo; registry is
            forbidden from sharing fees with a physician, hospital or their staff, so
            there is no commission, no rebate and no rewards scheme here — not now and
            not later without a lawyer saying otherwise.
          </p>
          <p>
            {OPERATOR_NAME
              ? <>If you want to talk any of this through, {OPERATOR_NAME} is the person to ask.</>
              : <>If you want to talk any of this through, call us.</>}
            {line ? <> The direct line is {line}.</> : null}
          </p>
        </Prose>
      </Section>
    </Stack>
  );
}
