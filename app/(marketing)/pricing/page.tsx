import type { Metadata } from 'next';
import { publicMetadata } from '@/lib/brand';
import { Prose, Scroller, Section, Stack } from '@/components/layout';
import {
  CREDENTIAL_LABEL, CREDENTIAL_ORDER, formatRange, rateState, type RateRange,
} from '@/lib/rates';
import { EMBARGO_DAYS, feeCommitments, type FeeCommitment } from '@/lib/feeSchedule';

export const metadata: Metadata = publicMetadata({
  title: 'Rates and fees',
  description:
    'What care costs in Century City and West Los Angeles, by credential level, what we '
    + 'charge a household, and why a nurse is never charged.',
}, '/pricing');

/**
 * Hourly. The ranges come from the table the operator maintains, never from this file.
 * A literal because Next analyses this statically — it cannot follow an imported
 * constant. RATE_REVALIDATE_SECONDS in lib/rates.ts holds the same number, and a test
 * asserts the two agree.
 */
export const revalidate = 3600;

const SERVICE_LABEL: Record<string, string> = {
  companion: 'Companionship',
  personal_care: 'Personal care',
  post_surgical: 'Post-surgical recovery',
  skilled_nursing: 'Skilled nursing',
  overnight_newborn: 'Overnight newborn care',
  respite: 'Respite',
  hospice_support: 'Hospice support',
};

const SERVICE_ORDER = [
  'companion', 'personal_care', 'post_surgical', 'overnight_newborn',
  'skilled_nursing', 'hospice_support', 'respite',
];

/**
 * The caption belongs to the table and is written here once so that it cannot be left
 * behind again.
 *
 * It had been sitting outside the branch that renders the table, so in the state this
 * page is actually in most of the time — nothing posted, nothing to show — the section
 * read "No ranges are posted at the moment" and then, underneath, a line describing a
 * table that was not there. A caption for absent content is worse than no caption: it
 * tells the reader something was meant to be here and does not say what.
 */
const RATE_TABLE_CAPTION =
  'Provider-set and negotiated directly with the provider. Updated from our own roster.';

/**
 * A figure the operator has to supply, printed as the gap it is.
 *
 * Marked rather than tidied away on purpose. This is the one part of the site where a
 * plausible sentence is worse than a blank, because nobody reading it can tell a
 * decided percentage from a deployment default — and a household that agreed to an
 * invented figure was quoted a price by a stand-in. So the page says what is missing,
 * which variable fills it and who may decide it, and anybody looking at the deployment
 * knows what to do rather than only that something is absent. lib/feeSchedule.ts
 * carries the list and the reasoning.
 */
function Unfilled({ commitment }: { commitment: FeeCommitment }) {
  return (
    <span
      className="label"
      data-unfilled={commitment.id}
      style={{ color: 'var(--crit)', letterSpacing: '.04em' }}
    >
      Not published yet: {commitment.needs}. Supplied by {commitment.who}, in{' '}
      <span className="mono">{commitment.env}</span>.
    </span>
  );
}

export default async function Pricing() {
  const { ranges, unavailable } = await rateState();
  const byService = new Map<string, RateRange[]>();
  for (const r of ranges) {
    byService.set(r.serviceKey, [...(byService.get(r.serviceKey) ?? []), r]);
  }
  const services = SERVICE_ORDER.filter((s) => byService.has(s));
  const fees = feeCommitments();

  return (
    <Stack gap="lg">
      <Section>
        <h1>Rates and fees</h1>
        <Prose>
          <p style={{ fontSize: 'var(--step-1)', color: 'var(--ink-2)' }}>
            Two different things, and they are not both ours. The provider sets their
            rate and agrees it with you directly. Our fee is what we charge the
            household for finding them, and it is the only money we take.
          </p>
          <p>
            We neither set nor cap what anyone charges. A provider whose rate sits above a
            range is not excluded from a short list — experience is priced, and sometimes
            the right person costs more.
          </p>
        </Prose>
      </Section>

      <Section title="By credential level" as="h2">
        {services.length === 0 ? (
          <Prose>
            {/*
              * Two sentences, because they are two different facts and the page used to
              * say the first one for both: nothing posted, and could not read the table.
              */}
            <p>
              {unavailable
                ? 'We cannot reach our own rate records just now. Call us and we will '
                  + 'tell you what we are seeing this week.'
                : 'No ranges are posted at the moment. Call us and we will tell you what '
                  + 'we are seeing this week — the numbers here come from our own roster '
                  + 'and we would rather show you none than show you stale ones.'}
            </p>
          </Prose>
        ) : (
          <>
            {/*
              * `Scroller` and not a bare `.scroller` div. At 320px this table is 666px
              * wide, which is right — the page itself must never scroll sideways, so the
              * table scrolls inside its own box. But a div with `overflow-x: auto` is not
              * focusable, so the four credential columns past the right-hand edge were
              * unreachable from a keyboard: the rates § 1812.527 is about, on a phone,
              * with no way to get at them. The component adds the tab stop, the role and
              * the name together, because a focusable region that announces nothing is
              * the next defect along.
              */}
            <Scroller label="Hourly rate ranges by care type and credential level">
              <table className="nums">
                <thead>
                  <tr>
                    <th scope="col">Care</th>
                    {CREDENTIAL_ORDER.map((level) => (
                      <th key={level} scope="col">{CREDENTIAL_LABEL[level]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => {
                    const rows = byService.get(service) ?? [];
                    return (
                      <tr key={service}>
                        <th scope="row" style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--ink)' }}>
                          {SERVICE_LABEL[service] ?? service}
                        </th>
                        {CREDENTIAL_ORDER.map((level) => {
                          const r = rows.find((x) => x.credentialLevel === level);
                          return (
                            <td key={level} style={{ color: r ? 'var(--ink)' : 'var(--ink-3)' }}>
                              {r ? formatRange(r) : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Scroller>
            <p className="label" style={{ marginTop: '1rem' }}>{RATE_TABLE_CAPTION}</p>
          </>
        )}
      </Section>

      <Section title="What we charge" as="h2">
        <Prose>
          <p>
            A fixed percentage of the cost of the engagement, charged to the household and
            agreed before any referral is made. It is never taken out of what the provider
            earns, and there is no charge to a provider of any kind.
          </p>
          <p>
            There is no joining fee, no minimum term and no charge for replacing someone
            who turns out not to fit.
          </p>
        </Prose>

        <dl style={{ marginTop: '1.5rem', maxWidth: 'var(--measure)' }}>
          {fees.map((c) => (
            <div key={c.id} style={{ marginBottom: '1.1rem' }}>
              <dt className="label" style={{ marginBottom: '.3rem' }}>{c.label}</dt>
              <dd style={{ margin: 0, color: 'var(--ink-2)' }}>
                {c.value
                  ? <span className="nums">{c.value}</span>
                  : <Unfilled commitment={c} />}
              </dd>
            </div>
          ))}
        </dl>

        <Prose>
          <p>
            Ask us for the figure when we call, before anybody is put forward. The
            schedule we post sets the most we may charge and it covers all of it, so
            there is nothing added on top of it later.
          </p>
        </Prose>
      </Section>

      <Section title="The schedule we post" as="h2">
        <Prose>
          <p>
            The law covering nursing referrals requires us to post our schedule of fees,
            and to post any change to it at least {EMBARGO_DAYS} days before it takes
            effect. That notice period is the point of it: terms cannot change under
            somebody who is partway through something.
          </p>
          <p>
            A nurse is given the schedule before their interview rather than at signing,
            and every version of it stays available to them afterwards, with the date it
            was posted and the date it took effect. We would rather be asked to produce
            that record than be trusted about it.
          </p>
          <p>
            A nurse is never charged for any of this — no registration fee, no joining
            fee, nothing deducted from what they are paid, and nothing signed over to us.
            That is the law for a nurses&rsquo; registry, and it is also the shape of the
            whole arrangement: we are paid by the household for the introduction and by
            nobody else — not by a provider, and not by a hospital or a physician for
            sending somebody our way.
          </p>
          <p>
            If you would like the schedule as it stands now, ask us and we will send it
            to you.
          </p>
        </Prose>
      </Section>

      <Section title="Paying for it" as="h2">
        <Prose>
          <p>
            Most of our households pay privately. Some have a long-term care policy, and
            we will put together what the carrier needs — the hours, the dates, the kind
            of care — though whether a policy pays is between you and them.
          </p>
        </Prose>
      </Section>
    </Stack>
  );
}
