import { redirect } from 'next/navigation';
import { getPortalSession } from '@/lib/session';
import { RESTRICTIONS_MAX, providerSelf } from '@/lib/pro';
import { SaveForm, fieldStyle } from '@/components/SaveForm';
import { updateLimits } from '../actions';
import { Prose, Section, Stack } from '@/components/layout';

export const dynamic = 'force-dynamic';

export default async function ProLimits() {
  const session = await getPortalSession();
  if (!session) redirect('/login');
  const me = await providerSelf(session);
  if (!me) redirect('/login');

  return (
    <Stack gap="lg">
      <Section title="What you will not take on" as="h1">
        <Prose>
          <p>
            Write this however you like. It is shown to households word for word — we
            do not turn it into tags, categories or a tidier sentence, because the
            point of it is that the limits are yours and read as yours.
          </p>
          <p style={{ fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
            Saying no to something costs you nothing here. It is not held against you,
            it does not affect what we put you forward for beyond the obvious, and
            there is no record anywhere of how often you decline.
          </p>
        </Prose>

        <div style={{ marginTop: '1.5rem' }}>
          <SaveForm action={updateLimits}>
            <label htmlFor="restrictions" className="label" style={{ display: 'block', marginBottom: '.35rem' }}>
              In your own words
            </label>
            <textarea
              id="restrictions" name="restrictions" rows={7} maxLength={RESTRICTIONS_MAX}
              defaultValue={me.restrictions ?? ''} style={fieldStyle}
              placeholder="No heavy lifting without a hoist. I do not drive clients. I would rather not take overnight work on weekends."
            />
          </SaveForm>
        </div>
      </Section>
    </Stack>
  );
}
