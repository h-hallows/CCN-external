/**
 * The posted fee schedule. Civ. Code § 1812.527, web build spec § 9.2, W8.
 *
 * NURSES ONLY. Chapter 7 (§§ 1812.524–1812.533) governs nurses' registries and has
 * obligations with no § 1812.5095 equivalent; this is one of them. A CNA, HCA or
 * companion has no posted schedule and the screen says so rather than showing an empty
 * table.
 *
 * THE SEVEN-DAY EMBARGO. § 1812.527 requires a schedule to be posted at least seven
 * days before it takes effect, and migration 0004 CHECKs it:
 *
 *   effective_from >= (posted_at AT TIME ZONE 'America/Los_Angeles')::date + 7
 *
 * so a schedule that would take effect sooner cannot be stored at all. The screen shows
 * both dates and the gap, because the provider is the party the embargo protects: it
 * exists so terms cannot change under someone mid-engagement, and that is only worth
 * anything if they can see when the clock started.
 *
 * Prior versions stay listed. A schedule that quietly replaces its predecessor leaves
 * nobody able to say what the terms were when they signed.
 *
 * WHAT A PROVIDER CAN SEE. `fee_schedules_provider_select` scopes this to schedules
 * RECORDED AS DELIVERED TO THEM, not to every schedule ever posted. That is narrower
 * than "the posted schedule" sounds, and it is the right shape: § 1812.527 is about
 * what the nurse was given and when, so the screen answers that question rather than
 * showing a public noticeboard. A version nobody recorded delivering does not appear,
 * which makes a missing delivery visible as a gap rather than hidden behind a list
 * that looks complete.
 */
import { isoLA } from '@h-hallows/core/domain';
import { asPortalUser } from './portalDb';
import type { PortalSession } from './session';

export interface FeeSchedule {
  version: number;
  maxFeePct: string;
  paymentTerms: string;
  body: string;
  postedOn: string;
  effectiveFrom: string;
  /** Days between posting and taking effect. Never fewer than seven. */
  noticeDays: number;
  inForce: boolean;
  /** Posted, within its notice period, not yet in effect. */
  upcoming: boolean;
  /** When this provider was given it, and whether that was before the interview. */
  deliveredOn: string | null;
  deliveredBeforeInterview: boolean | null;
}

/** § 1812.527 applies to nurses. The others have no posted schedule. */
export function hasFeeSchedule(type: string): boolean {
  return type === 'RN' || type === 'LVN';
}

export const EMBARGO_DAYS = 7;

export async function feeSchedulesFor(
  session: PortalSession,
  now = new Date(),
): Promise<FeeSchedule[]> {
  if (!session.providerId) return [];

  return asPortalUser(session, async (tx) => {
    const rows = await tx.query<{
      id: string; version: number; max_fee_pct: string; payment_terms: string;
      body: string; posted_at: string; effective_from: string;
      delivered_at: string | null; before_interview: boolean | null;
    }>(
      `SELECT f.id, f.version, f.max_fee_pct::text, f.payment_terms, f.body,
              f.posted_at::text, f.effective_from::text,
              d.delivered_at::text, d.before_interview
         FROM fee_schedules f
         LEFT JOIN fee_schedule_deliveries d
           ON d.schedule_id = f.id AND d.provider_id = $1
        ORDER BY f.version DESC`,
      [session.providerId],
    );

    /*
     * California's date, not UTC's. toISOString() is UTC, so between late afternoon
     * and midnight Pacific it already reads as tomorrow — and a schedule effective
     * tomorrow would show as in force up to eight hours early, every working evening.
     * The § 1812.527 seven-day embargo is the thing this screen exists to make
     * auditable, so that is a compliance-visible error rather than a cosmetic one.
     *
     * Everything else in the system is explicitly LA-civil: the CHECK constraint, the
     * rate_ranges query and v_shortlist_items_client all use
     * (now() AT TIME ZONE 'America/Los_Angeles')::date. isoLA is core's helper for it.
     */
    const today = isoLA(now);
    // In force = the latest effective date that has arrived, by date rather than by
    // version number — a lower version can be posted later.
    const live = [...rows]
      .filter((r) => r.effective_from <= today)
      .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))[0];

    return rows.map((r) => {
      const posted = r.posted_at.slice(0, 10);
      return {
        version: r.version,
        maxFeePct: r.max_fee_pct,
        paymentTerms: r.payment_terms,
        body: r.body,
        postedOn: posted,
        effectiveFrom: r.effective_from,
        noticeDays: Math.round(
          (Date.parse(`${r.effective_from}T00:00:00Z`) - Date.parse(`${posted}T00:00:00Z`))
          / 86_400_000,
        ),
        inForce: live?.id === r.id,
        upcoming: r.effective_from > today,
        deliveredOn: r.delivered_at ? r.delivered_at.slice(0, 10) : null,
        deliveredBeforeInterview: r.before_interview,
      };
    });
  });
}

/**
 * WHAT THE PUBLIC PAGE MAY SAY ABOUT THE FEE, AND WHY IT PUBLISHES RATHER THAN READS.
 *
 * § 1812.527 wants the schedule posted, and /pricing is where a household looks for it.
 * The schedule above is not available to that page, and the reason is worth writing
 * down so nobody plumbs it in later believing it was an oversight:
 *
 *  - `fee_schedules` has FORCE ROW LEVEL SECURITY and exactly two policies (core
 *    migration 0004): the operator, and a provider the schedule was recorded as
 *    delivered to. A public page is neither, so the query returns nothing — not an
 *    error, nothing, which is the shape of failure that gets shipped.
 *  - every portal read goes through `asPortalUser`, and tests/portal.test.ts holds the
 *    list of files allowed to reach `getDb()` directly. Reading the table from here
 *    would mean adding this file to that list, which is to say stepping around the one
 *    mechanism that makes the § 4 matrix apply rather than merely exist.
 *
 * So the figures a household is quoted are PUBLISHED here — read from configuration,
 * exactly as the business name is in lib/brand.ts — and not derived from the table.
 *
 * WHAT KEEPS A PUBLISHED FIGURE HONEST. A number on a page that has drifted from the
 * schedule in force is a misleading advertisement under § 1812.533(b)(1), which is the
 * same reason lib/rates.ts refuses to let a rate be typed into a page. The seven-day
 * embargo is what makes publishing safe anyway: a schedule cannot take effect sooner
 * than EMBARGO_DAYS after it is posted, and the CHECK constraint refuses to store one
 * that would, so whoever maintains these variables always has the notice period in
 * which to change them. Set them from the schedule in force, inside that window.
 *
 * WHY AN UNSET ONE PRINTS A PLACEHOLDER RATHER THAN A PLAUSIBLE NUMBER. Nobody reading
 * the page can tell an invented percentage from a decided one, and a household that
 * agrees to a figure we made up has been quoted a price by a deployment default. The
 * same reasoning as PRELAUNCH_NAME in lib/brand.ts: a stand-in that could be mistaken
 * for the real thing is worse than a blank that says what is missing.
 */
export interface FeeCommitment {
  /** Stable, and what the page marks the placeholder with. */
  readonly id: string;
  /** The variable that fills it. */
  readonly env: string;
  /** What a household is being told, said as the page says it. */
  readonly label: string;
  /** What has to be supplied. */
  readonly needs: string;
  /** Who can decide it. Nobody else may. */
  readonly who: string;
  /** The configured value, or null while nobody has supplied one. */
  readonly value: string | null;
}

/**
 * Read as literals rather than through a loop over the names, because Next substitutes
 * `process.env.NEXT_PUBLIC_*` where it appears in the source and cannot follow an
 * indexed read. lib/brand.ts reads its own the same way and for the same reason.
 *
 * The two are the two columns of the posted schedule a household asks about —
 * `max_fee_pct` and `payment_terms`. Nothing else from that row belongs on a public
 * page: the body is written for the nurse it is delivered to, and the posting dates
 * are the record of an obligation owed to them rather than to a household.
 */
export function feeCommitments(): FeeCommitment[] {
  const filled = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
  return [
    {
      id: 'fee-pct',
      env: 'NEXT_PUBLIC_FEE_PCT',
      label: 'What we charge',
      needs: 'the percentage of the cost of the engagement charged to the household, '
        + 'as the fee schedule now in force states it',
      who: 'the operator, from the schedule posted in the console',
      value: filled(process.env.NEXT_PUBLIC_FEE_PCT),
    },
    {
      id: 'fee-terms',
      env: 'NEXT_PUBLIC_FEE_TERMS',
      label: 'When it is invoiced',
      needs: 'when the fee is invoiced and how it is paid, in the same words as the '
        + 'payment terms on that schedule',
      who: 'the operator, from the same posted schedule',
      value: filled(process.env.NEXT_PUBLIC_FEE_TERMS),
    },
  ];
}

/** The ones nobody has supplied. Each is printed on the page as a marked placeholder. */
export function unfilledFeeCommitments(): FeeCommitment[] {
  return feeCommitments().filter((c) => c.value === null);
}
