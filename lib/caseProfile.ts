/**
 * The one thing a household writes about its own care. Web build spec § 4.1, W7.
 *
 * This is the document that travels to whoever covers a shift — the routine, where the
 * key is, which chair she likes, what matters at 3am. It is the household's own words
 * and nothing generates it, suggests it or templates it. That is I10
 * (§ 1812.5095(b)(5)) and it is also the only reason the document is any good: a
 * substitute arriving at seven in the morning needs what the family actually knows, not
 * a form somebody filled in.
 *
 * `cases.needs_profile` is a different field and is NOT writable here. It records what
 * the household said at intake and is part of the record, not a living document.
 * Migration 0003's `cases_household_update_guard` enforces the distinction in the
 * database: a household UPDATE that changes any column but `household_profile` raises.
 */
import { asPortalUser } from './portalDb';
import { PROFILE_MAX } from './profileLimits';
import type { PortalSession } from './session';

export { PROFILE_MAX };

export interface CaseProfile {
  caseId: string;
  care: string;
  body: string;
  /** The provider who would read it, when there is one. Makes the stakes concrete. */
  readBy: string | null;
}

export type SaveOutcome =
  | { ok: true; savedAt: string }
  | { ok: false; reason: 'not_found' | 'too_long' | 'failed' };

export async function caseProfiles(session: PortalSession): Promise<CaseProfile[]> {
  if (!session.householdId) return [];
  return asPortalUser(session, async (tx) => {
    const rows = await tx.query<{
      id: string; care: string; household_profile: string | null;
      primary_provider_id: string | null;
    }>(
      `SELECT id, care::text AS care, household_profile, primary_provider_id
         FROM cases
        WHERE status <> 'ended' AND deleted_at IS NULL
        ORDER BY created_at DESC`,
    );
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.primary_provider_id).filter((i): i is string => Boolean(i));
    const names = new Map<string, string>();
    if (ids.length > 0) {
      const providers = await tx.query<{ id: string; full_name: string }>(
        `SELECT id, full_name FROM providers WHERE id = ANY($1::uuid[])`, [ids]);
      for (const p of providers) names.set(p.id, p.full_name);
    }

    return rows.map((r) => ({
      caseId: r.id,
      care: r.care,
      body: r.household_profile ?? '',
      readBy: r.primary_provider_id ? names.get(r.primary_provider_id) ?? null : null,
    }));
  });
}

export async function saveCaseProfile(
  session: PortalSession,
  caseId: string,
  body: string,
): Promise<SaveOutcome> {
  if (!session.householdId) return { ok: false, reason: 'not_found' };
  if (body.length > PROFILE_MAX) return { ok: false, reason: 'too_long' };

  try {
    const rows = await asPortalUser(session, (tx) => tx.query<{ id: string }>(
      // One column. The policy scopes the row to this household and the guard trigger
      // refuses an UPDATE that touches anything else, so neither the scope nor the
      // column list depends on this statement being written carefully.
      `UPDATE cases SET household_profile = $2 WHERE id = $1 RETURNING id`,
      [caseId, body.trim() === '' ? null : body],
    ));
    // No row means the policy did not match it. Not found, not forbidden.
    if (rows.length === 0) return { ok: false, reason: 'not_found' };
    return { ok: true, savedAt: new Date().toISOString() };
  } catch (err) {
    console.error('[profile] could not save', err);
    return { ok: false, reason: 'failed' };
  }
}
