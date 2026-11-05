import { redirect } from 'next/navigation';
import { getPortalSession } from '@/lib/session';
import { caseProfiles } from '@/lib/caseProfile';
import { HouseholdProfile } from '@/components/HouseholdProfile';
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

export default async function Profile() {
  const session = await getPortalSession();
  if (!session) redirect('/login');
  const profiles = await caseProfiles(session);

  if (profiles.length === 0) {
    return (
      <Section title="About your household" as="h1">
        <Prose>
          <p>
            Once care is being arranged, this is where you tell us what someone
            arriving at your door should know.
          </p>
        </Prose>
      </Section>
    );
  }

  return (
    <Stack gap="lg">
      {profiles.map((p) => (
        <Section
          key={p.caseId}
          label={CARE_LABEL[p.care] ?? p.care}
          title="About your household"
          as="h1"
        >
          <Prose>
            <p>
              The routine, how to get in, what is worth knowing before the first
              morning. Write it however you like — these are your words and we do not
              edit them, summarise them or put them through anything.
            </p>
          </Prose>

          <div style={{ marginTop: '1.25rem' }}>
            <HouseholdProfile caseId={p.caseId} initial={p.body} readBy={p.readBy} />
          </div>
        </Section>
      ))}
    </Stack>
  );
}
