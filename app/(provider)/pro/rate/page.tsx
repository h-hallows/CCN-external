import { redirect } from 'next/navigation';
import { getPortalSession } from '@/lib/session';
import { RATE_NOTES_MAX, providerSelf } from '@/lib/pro';
import { SaveForm, fieldStyle } from '@/components/SaveForm';
import { updateRate } from '../actions';
import { Prose, Section, Stack } from '@/components/layout';

export const dynamic = 'force-dynamic';

export default async function ProRate() {
  const session = await getPortalSession();
  if (!session) redirect('/login');
  const me = await providerSelf(session);
  if (!me) redirect('/login');

  return (
    <Stack gap="lg">
      <Section title="Your rate" as="h1">
        {/*
          * I5, § 1812.5095(b)(3) and § 687.2(c). There is no suggested figure here, no
          * range, no "providers near you charge", no cap and no floor — every one of
          * those is the registry setting a rate it has no business setting, and a
          * default would anchor it just as effectively as a rule.
          *
          * The only validation is that a number is a number above zero.
          */}
        <Prose>
          <p>
            You set this, and it stays negotiable with the household. We do not set it,
            cap it, suggest it or take a share of it — our fee is charged to the
            household as a percentage of the job and never comes out of your hours.
          </p>
          <p style={{ fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
            Leave it empty if you would rather talk about it. That is a normal answer
            and we will say so when we put you forward.
          </p>
        </Prose>

        <div style={{ marginTop: '1.5rem' }}>
          <SaveForm action={updateRate}>
            <label htmlFor="rateHourly" className="label" style={{ display: 'block', marginBottom: '.35rem' }}>
              Your hourly rate
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', maxWidth: '12rem' }}>
              <span aria-hidden style={{ color: 'var(--ink-3)' }}>$</span>
              <input
                id="rateHourly" name="rateHourly" type="text" inputMode="decimal"
                className="nums" defaultValue={me.rateHourly ?? ''} style={fieldStyle}
              />
              <span style={{ color: 'var(--ink-3)', fontSize: 'var(--step--1)' }}>an hour</span>
            </div>

            <label htmlFor="rateNotes" className="label" style={{ display: 'block', margin: '1.1rem 0 .35rem' }}>
              Anything you want said alongside it
            </label>
            <textarea
              id="rateNotes" name="rateNotes" rows={4} maxLength={RATE_NOTES_MAX}
              defaultValue={me.rateNotes ?? ''} style={fieldStyle}
              placeholder="Overnights are different — happy to discuss."
            />
          </SaveForm>
        </div>
      </Section>
    </Stack>
  );
}
