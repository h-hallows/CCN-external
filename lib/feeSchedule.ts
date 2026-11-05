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
