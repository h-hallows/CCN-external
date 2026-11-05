/**
 * The client portal's schedule. Web build spec § 4.1, W7.
 *
 * Three reads in one transaction under the household's own claims: the case and its
 * pattern, the people covering it, and the gaps in the next thirty days. The provider
 * names are readable because of migration 0007 — before it, a household lost sight of
 * its own nurse the moment the operator withdrew the shortlist.
 *
 * What this is not. There is no roster here, no shift allocation, no assignment. The
 * system records the pattern the household asked for and the availability the provider
 * stated, and shows where the two fail to meet. Generating cover would be work
 * direction (I2, § 1812.5095(b)(5)), and it is the operator who arranges it by phone.
 */
import type { Tx } from '@h-hallows/core/db';
import { asPortalUser } from './portalDb';
import type { PortalSession } from './session';

export interface CoverageGap {
  onDate: string;
  block: string;
  note: string | null;
  /** Set once somebody has agreed to cover it. */
  coveredBy: string | null;
}

export interface CaseSchedule {
  caseId: string;
  care: string;
  startsOn: string | null;
  hoursPerWeek: number | null;
  /** 'Mon:AM' — the same vocabulary a provider states availability in. */
  pattern: string[];
  primary: string | null;
  alternates: string[];
  gaps: CoverageGap[];
}

interface CaseRow {
  id: string;
  care: string;
  starts_on: string | null;
  hours_per_week: number | null;
  schedule: string[] | null;
  primary_provider_id: string | null;
  alternate_provider_ids: string[] | null;
}

const GAP_WINDOW_DAYS = 30;

export async function caseSchedules(session: PortalSession): Promise<CaseSchedule[]> {
  if (!session.householdId) return [];

  return asPortalUser(session, async (tx: Tx) => {
    const cases = await tx.query<CaseRow>(
      `SELECT id, care::text AS care, starts_on::text, hours_per_week, schedule,
              primary_provider_id, alternate_provider_ids
         FROM cases
        WHERE status <> 'ended' AND deleted_at IS NULL
        ORDER BY created_at DESC`,
    );
    if (cases.length === 0) return [];

    const wanted = [...new Set(cases.flatMap((c) => [
      c.primary_provider_id, ...(c.alternate_provider_ids ?? []),
    ]).filter((id): id is string => Boolean(id)))];

    const names = new Map<string, string>();
    if (wanted.length > 0) {
      const rows = await tx.query<{ id: string; full_name: string }>(
        `SELECT id, full_name FROM providers WHERE id = ANY($1::uuid[])`, [wanted]);
      for (const r of rows) names.set(r.id, r.full_name);
    }

    const gaps = await tx.query<{
      case_id: string; on_date: string; block: string; note: string | null;
      resolved_provider_id: string | null; covered_by: string | null;
    }>(
      // LEFT JOIN rather than a second lookup: a provider who resolved a gap is visible
      // under 0007, and a gap nobody has taken yet must still appear.
      `SELECT g.case_id, g.on_date::text, g.block::text AS block, g.note,
              g.resolved_provider_id, p.full_name AS covered_by
         FROM coverage_gaps g
         LEFT JOIN providers p ON p.id = g.resolved_provider_id
        -- California's date. No connection sets TimeZone, so current_date is the
        -- server's — UTC on a managed Postgres. From late afternoon Pacific that is
        -- already tomorrow, and this window would silently drop TONIGHT's gaps,
        -- including the overnight block, which is the one that matters at that hour.
        WHERE g.on_date >= (now() AT TIME ZONE 'America/Los_Angeles')::date
          AND g.on_date < (now() AT TIME ZONE 'America/Los_Angeles')::date + $1::int
        ORDER BY g.on_date, g.block`,
      [GAP_WINDOW_DAYS],
    );

    return cases.map((c) => ({
      caseId: c.id,
      care: c.care,
      startsOn: c.starts_on,
      hoursPerWeek: c.hours_per_week,
      pattern: c.schedule ?? [],
      primary: c.primary_provider_id ? names.get(c.primary_provider_id) ?? null : null,
      alternates: (c.alternate_provider_ids ?? [])
        .map((id) => names.get(id))
        .filter((n): n is string => Boolean(n)),
      gaps: gaps
        .filter((g) => g.case_id === c.id)
        .map((g) => ({
          onDate: g.on_date,
          block: g.block,
          note: g.note,
          coveredBy: g.covered_by,
        })),
    }));
  });
}

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const BLOCKS = ['AM', 'PM', 'NOC'] as const;

export const BLOCK_LABEL: Record<string, string> = {
  AM: 'Morning', PM: 'Afternoon', NOC: 'Overnight',
};

/** `{ 'Mon': Set('AM','PM') }`, for rendering a week as a grid rather than a list. */
export function byDay(pattern: string[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const slot of pattern) {
    const [day, block] = slot.split(':');
    if (!day || !block) continue;
    const existing = out.get(day) ?? new Set<string>();
    existing.add(block);
    out.set(day, existing);
  }
  return out;
}
