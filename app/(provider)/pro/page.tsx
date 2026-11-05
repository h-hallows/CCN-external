import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPortalSession } from '@/lib/session';
import { credentialStanding, providerSelf } from '@/lib/pro';
import { hasFeeSchedule } from '@/lib/feeSchedule';
import { Prose, Section, Stack } from '@/components/layout';

export const dynamic = 'force-dynamic';

export default async function ProHome() {
  const session = await getPortalSession();
  if (!session) redirect('/login');
  const me = await providerSelf(session);
  if (!me) redirect('/login');
  const standing = await credentialStanding(session);

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
            <li><Link href="/pro/credentials">Documents</Link></li>
            {hasFeeSchedule(me.type) ? (
              <li><Link href="/pro/fee-schedule">Fee schedule</Link></li>
            ) : null}
          </ul>
        </Prose>
      </Section>
    </Stack>
  );
}
