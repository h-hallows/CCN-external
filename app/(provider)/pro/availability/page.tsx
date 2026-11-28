import { redirect } from 'next/navigation';
import { getPortalSession } from '@/lib/session';
import { BLOCKS, BLOCK_LABEL, DAYS, providerSelf } from '@/lib/pro';
import { SaveForm } from '@/components/SaveForm';
import { updateAvailability } from '../actions';
import { Prose, Scroller, Section, Stack } from '@/components/layout';

export const dynamic = 'force-dynamic';

export default async function ProAvailability() {
  const session = await getPortalSession();
  if (!session) redirect('/login');
  const me = await providerSelf(session);
  if (!me) redirect('/login');

  const open = new Set(me.availability);

  return (
    <Stack gap="lg">
      <Section title="When you are open to work" as="h1">
        <Prose>
          <p>
            Tick what suits you. Change it whenever you like — there is no notice
            period, no minimum, and nothing to tell us first.
          </p>
          <p style={{ fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
            This is what you are open to, not a commitment to anything. Every piece of
            work is a separate conversation, and you can say no to any of it.
          </p>
        </Prose>

        <div style={{ marginTop: '1.5rem' }}>
          <SaveForm
            action={updateAvailability}
            label="Save availability"
            footnote="An empty week is a perfectly good answer and saves like any other."
          >
            <Scroller label="When you work, by day and shift">
              <table style={{ minWidth: '32rem' }}>
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
                      {DAYS.map((day) => {
                        const slot = `${day}:${block}`;
                        return (
                          <td key={day} style={{ textAlign: 'center' }}>
                            <label className="tick">
                              <span className="visually-hidden">
                                {day} {BLOCK_LABEL[block] ?? block}
                              </span>
                              <input
                                type="checkbox" name="slot" value={slot}
                                defaultChecked={open.has(slot)}
                              />
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroller>
          </SaveForm>
        </div>
      </Section>
    </Stack>
  );
}
