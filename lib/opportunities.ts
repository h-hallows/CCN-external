/**
 * Open opportunities and engagements. Web build spec § 4.2, architecture § 6.4, W9.
 *
 * AN OPPORTUNITY IS A REFERRAL AWAITING A RESPONSE. The operator makes the referral in
 * the console, in the same transaction as the statutory disclosure; this module shows
 * the provider what they have been put forward for and lets them say yes or no.
 *
 * WHAT A RESPONSE IS, AND IS NOT. Architecture spec § 6.4: "Decline takes no reason and
 * sets no flag anywhere that could later read as a performance record. Log it as a
 * timeline entry on the case, author = provider." So both answers are a note on the
 * case and nothing else. There is no `responded` column, no counter, no outcome write
 * and nothing aggregatable, because the moment a decline is countable somebody will
 * count it, and a provider whose declines are counted is being managed — § 687.2(e)
 * and I2. The operator sets `referrals.outcome` after speaking to people, which is
 * also the only place that fact can honestly come from.
 *
 * The row-level security that makes this safe already existed: `timeline_provider_insert`
 * admits a provider's row only when it is type 'note', carries their own provider_id,
 * and sits on a case they were actually referred to.
 */
import { AREAS, areaLabel } from '@h-hallows/core/domain';
import type { Tx } from '@h-hallows/core/db';
import { asPortalUser } from './portalDb';
import type { PortalSession } from './session';

export interface Opportunity {
  referralId: string;
  caseId: string;
  care: string;
  area: string | null;
  pattern: string[];
  hoursPerWeek: number | null;
  startsOn: string | null;
  /** The household's own words from intake. Never generated, never templated (I10). */
  needs: string | null;
  referredOn: string;
  /** What this provider has already said about it, if anything. */
  answeredOn: string | null;
}

export interface Engagement extends Opportunity {
  outcome: string | null;
  endedOn: string | null;
  /** The routine, access and preferences the household wrote. Travels with the work. */
  householdProfile: string | null;
}

interface Row {
  referral_id: string; case_id: string; care: string; schedule: string[] | null;
  hours_per_week: number | null; starts_on: string | null; needs_profile: string | null;
  household_profile: string | null; referred_at: string; outcome: string | null;
  ended_on: string | null; area: string | null; answered_at: string | null;
}

/**
 * The marker this module writes and reads back.
 *
 * A prefix on a free-text note rather than a column, so the answer stays a thing the
 * provider said on the case's timeline and never becomes a field something can group
 * by. It exists only so the screen does not offer the same decision twice.
 */
const ANSWER_PREFIX = 'Opportunity response:';

async function rows(session: PortalSession, tx: Tx): Promise<Row[]> {
  return tx.query<Row>(
    `SELECT r.id AS referral_id, c.id AS case_id, c.care::text AS care, c.schedule,
            c.hours_per_week, c.starts_on::text, c.needs_profile, c.household_profile,
            r.referred_at::text, r.outcome::text AS outcome, c.ended_on::text,
            case_area_for_provider(c.id) AS area,
            (SELECT max(t.at)::text FROM timeline_entries t
              WHERE t.case_id = c.id
                AND t.provider_id = $1
                AND t.body LIKE $2) AS answered_at
       FROM referrals r
       JOIN cases c ON c.id = r.case_id
      WHERE r.provider_id = $1
      ORDER BY r.referred_at DESC`,
    [session.providerId, `${ANSWER_PREFIX}%`],
  );
}

function toOpportunity(r: Row): Opportunity {
  return {
    referralId: r.referral_id,
    caseId: r.case_id,
    care: r.care,
    area: r.area,
    pattern: r.schedule ?? [],
    hoursPerWeek: r.hours_per_week,
    startsOn: r.starts_on,
    needs: r.needs_profile,
    referredOn: r.referred_at.slice(0, 10),
    answeredOn: r.answered_at ? r.answered_at.slice(0, 10) : null,
  };
}

/**
 * Live referrals: the operator has not resolved them and the case has not ended.
 *
 * Deliberately includes ones this provider has already answered, with `answeredOn`
 * set, rather than dropping them the moment they reply.
 *
 * That is not presentation. A server action triggers a router refresh of the current
 * route whether or not the action revalidates anything, so a dynamic page re-renders
 * straight after the click. If an answered opportunity disappeared from this list, the
 * card and the acknowledgement inside it would be unmounted by that refresh — the
 * provider would click and watch the whole thing silently vanish, with no confirmation
 * that a decision had been recorded. Keeping the row and rendering its answered state
 * from the server survives any number of refreshes, and lets them see what they said.
 */
export async function currentOpportunities(
  session: PortalSession,
): Promise<Opportunity[]> {
  if (!session.providerId) return [];
  return asPortalUser(session, async (tx) => {
    const all = await rows(session, tx);
    return all
      .filter((r) => r.outcome === null && r.ended_on === null)
      .map(toOpportunity);
  });
}

/** Just the ones still awaiting an answer. */
export async function openOpportunities(session: PortalSession): Promise<Opportunity[]> {
  return (await currentOpportunities(session)).filter((o) => o.answeredOn === null);
}

/** Everything they have been referred to, answered or not. § 4.2 /pro/engagements. */
export async function engagements(session: PortalSession): Promise<Engagement[]> {
  if (!session.providerId) return [];
  return asPortalUser(session, async (tx) => {
    const all = await rows(session, tx);
    return all.map((r) => ({
      ...toOpportunity(r),
      outcome: r.outcome,
      endedOn: r.ended_on,
      householdProfile: r.household_profile,
    }));
  });
}

export type RespondOutcome =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'already_answered' | 'failed' };

/**
 * Record what the provider said. One note, author = provider, and nothing else.
 *
 * `interested` is not stored as a boolean anywhere — it decides the wording of the
 * note and that is all. Both answers take exactly the same path, cost the same and
 * leave the same kind of record, which is what "rendered identically" has to mean
 * underneath the buttons for it to mean anything at all.
 */
export async function respondToOpportunity(
  session: PortalSession,
  referralId: string,
  interested: boolean,
): Promise<RespondOutcome> {
  if (!session.providerId) return { ok: false, reason: 'not_found' };

  try {
    return await asPortalUser(session, async (tx) => {
      const found = await tx.query<{ case_id: string; answered: string | null }>(
        `SELECT r.case_id,
                (SELECT max(t.at)::text FROM timeline_entries t
                  WHERE t.case_id = r.case_id AND t.provider_id = $1
                    AND t.body LIKE $3) AS answered
           FROM referrals r
          WHERE r.id = $2 AND r.provider_id = $1`,
        [session.providerId, referralId, `${ANSWER_PREFIX}%`],
      );
      const row = found[0];
      if (!row) return { ok: false, reason: 'not_found' } as const;
      if (row.answered) return { ok: false, reason: 'already_answered' } as const;

      await tx.query(
        `INSERT INTO timeline_entries (case_id, type, author, body, provider_id)
         VALUES ($1, 'note', $2, $3, $4)`,
        [
          row.case_id,
          session.displayName,
          interested
            ? `${ANSWER_PREFIX} available and interested. Please call to arrange it.`
            : `${ANSWER_PREFIX} not taking this one.`,
          session.providerId,
        ],
      );
      return { ok: true } as const;
    });
  } catch (err) {
    console.error('[opportunity] could not record the response', err);
    return { ok: false, reason: 'failed' };
  }
}

export const CARE_LABEL: Record<string, string> = {
  companion: 'Companionship',
  personal_care: 'Personal care',
  skilled_nursing: 'Skilled nursing',
  post_surgical: 'Post-surgical recovery',
  overnight_newborn: 'Overnight newborn care',
  respite: 'Respite',
  hospice_support: 'Hospice support',
};

/**
 * Kept as a map because every call site indexes it, and sourced from core so there is
 * one list rather than two.
 *
 * There were two. The console turns an enquiry into a household and stores the area as
 * `households.cr_area`, which the matcher compares to `providers.areas` by string
 * equality — so a slug that reached that column matched nobody, ever, on a case that
 * looked correct on every screen.
 */
export const AREA_LABEL: Record<string, string> = Object.fromEntries(
  AREAS.map((slug) => [slug, areaLabel(slug)]),
);
