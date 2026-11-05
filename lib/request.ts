/**
 * The request action. Web build spec § 10, W6 — one of the two milestones the spec says
 * to review twice.
 *
 * WHAT THIS MUST NOT DO. A household asking about someone on its bench produces a
 * `shortlist_requests` row and nothing else. It does not create a referral, it does not
 * place anyone, it does not reserve anyone's time, and it tells the household none of
 * those things happened. A referral is a statutory event: it carries the § 1812.5095(f)
 * oral disclosure, the written statement inside three business days, and for an RN or
 * LVN the § 1812.533(b)(4) nurses' registry disclosure before care starts. All of that
 * happens in the console, in one transaction, with an operator present. The gap between
 * "a family asked" and "a referral was made" is where every one of those obligations
 * lives, so the gap is load-bearing and this module is the thing that keeps it open.
 *
 * Four independent mechanisms hold the line, because one would be a single point of
 * failure in the part of the system that is hardest to recover from:
 *
 *  1. The INSERT below names four columns. `status` and `referral_id` are not among
 *     them, so they take their defaults — 'pending' and NULL.
 *  2. The row-level security insert policy (migration 0003) refuses any insert whose
 *     `status` is not 'pending' or whose `referral_id` is not NULL, and refuses one
 *     against a shortlist the household does not own or that has been withdrawn.
 *  3. `shortlist_requests` carries no trigger at all (migration 0002), because a
 *     trigger is exactly the mechanism that would turn a request into a referral.
 *  4. A test walks the import graph out of `app/(client)` and fails if any reachable
 *     module writes to the referral table. See tests/request.test.ts.
 *
 * Everything that reads or writes the household's own data goes through `asPortalUser`,
 * which drops to the non-owning `ccn_app` role first. Without that the policies would be
 * present and inert and point 2 would be decorative.
 */
import { asPortalUser } from './portalDb';
import { benchProvider } from './portal';
import { notifyOperator } from './notify';
import type { PortalSession } from './session';
import type { RequestProviderInput } from './schemas/request';

export type RequestRefusal =
  /**
   * Not on a live bench of this household's.
   *
   * Three different situations arrive here as one answer, deliberately. A provider who
   * was never on their list, a provider on somebody else's, and a provider on a list the
   * operator has since withdrawn all come back not found.
   *
   * The third is not laziness. `household_owns_shortlist` defaults to requiring a live
   * list, so the policy on `published_shortlist_items` makes a withdrawn bench's contents
   * invisible to the household outright — telling them "that list is no longer current"
   * would mean reading, under an elevated claim, something the policy had just decided
   * was not theirs to see. Working around a policy to improve an error message is the
   * wrong trade. The copy points them at their current list instead, which is the useful
   * half of that answer anyway.
   *
   * It also leaks less: "forbidden" would confirm that a provider exists and is on
   * somebody's bench.
   */
  | 'not_found'
  /** A required credential is missing or lapsed right now. The reason never crosses. */
  | 'unavailable';

export type RequestOutcome =
  | { ok: true; requestId: string; alreadyAsked: boolean }
  | { ok: false; reason: RequestRefusal };

export interface ExistingRequest {
  requestId: string;
  requestedAt: string;
  status: string;
}

/**
 * Whether this household already has an open request about this provider.
 *
 * Read under the household's own claims, so the policy scopes it. Used by the profile to
 * say what was already asked rather than offering the same ask twice.
 */
export async function openRequestFor(
  session: PortalSession,
  providerId: string,
): Promise<ExistingRequest | null> {
  if (!session.householdId) return null;
  const rows = await asPortalUser(session, (tx) => tx.query<{
    id: string; requested_at: string; status: string;
  }>(
    `SELECT r.id, r.requested_at::text, r.status::text AS status
       FROM shortlist_requests r
       JOIN published_shortlists s ON s.id = r.shortlist_id
      WHERE r.provider_id = $1
        AND s.withdrawn_at IS NULL
        AND r.status = 'pending'
      ORDER BY r.requested_at DESC
      LIMIT 1`,
    [providerId],
  ));
  const row = rows[0];
  return row
    ? { requestId: row.id, requestedAt: row.requested_at, status: row.status }
    : null;
}

export async function requestProvider(
  session: PortalSession,
  input: RequestProviderInput,
  now = new Date(),
): Promise<RequestOutcome> {
  if (!session.householdId) return { ok: false, reason: 'not_found' };

  // The same scoped, eligibility-checked read the profile page renders from. Doing the
  // check again here rather than trusting the page is the whole point: the disabled
  // button is a courtesy, this is the control. A credential can lapse between the render
  // and the click, and a request posted straight at the action never saw the page at all.
  const provider = await benchProvider(session, input.providerId, now);
  if (!provider) return { ok: false, reason: 'not_found' };
  if (!provider.available) return { ok: false, reason: 'unavailable' };

  const note = input.note?.trim() ? input.note.trim() : null;

  const written = await asPortalUser(session, async (tx) => {
    // Check and insert in one transaction, so a double click or a double-posted form
    // produces one row rather than two identical asks in the operator's queue. A second
    // ask once the first has been resolved is a real event and is allowed.
    const open = await tx.query<{ id: string }>(
      `SELECT id FROM shortlist_requests
        WHERE shortlist_id = $1 AND provider_id = $2 AND status = 'pending'
        LIMIT 1`,
      [provider.shortlistId, input.providerId],
    );
    const already = open[0];
    if (already) return { id: already.id, fresh: false };

    // Four columns. Not `status`, not `referral_id` — see the header.
    const rows = await tx.query<{ id: string }>(
      `INSERT INTO shortlist_requests (shortlist_id, provider_id, requested_by, note)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [provider.shortlistId, input.providerId, session.userId, note],
    );
    const row = rows[0];
    if (!row) throw new Error('the request was not recorded');
    return { id: row.id, fresh: true };
  });

  if (written.fresh) {
    // § 7: immediate, and pushed. The subject and body say that something arrived and
    // nothing about who — not the household, not the provider, not the care. The console
    // reads `payload`, which never reaches an inbox.
    await notifyOperator({
      kind: 'shortlist_request',
      urgency: 'same_day',
      subject: 'A family has asked about someone on their short list',
      body: 'Open the console to see which case it is and who they asked about. '
        + 'A request is not a referral, and the statutory disclosure is still outstanding.',
      payload: {
        requestId: written.id,
        caseId: provider.caseId,
        shortlistId: provider.shortlistId,
        providerId: input.providerId,
        householdId: session.householdId,
        requestedBy: session.userId,
        note,
      },
    });
  }

  return { ok: true, requestId: written.id, alreadyAsked: !written.fresh };
}

/**
 * Every request this household has made. Web build spec § 4.1, /portal/requests.
 *
 * Deliberately includes requests against a shortlist the operator has since withdrawn:
 * `shortlist_requests_household_select` passes require_live = false precisely so a
 * household's own history does not vanish when a bench is taken down. The provider
 * names survive it too, under migration 0007.
 */
export interface HouseholdRequest {
  requestId: string;
  providerName: string;
  requestedOn: string;
  status: string;
  note: string | null;
  /** Set once the request has become a referral, so the feedback form can be offered. */
  referralId: string | null;
}

export async function householdRequests(
  session: PortalSession,
): Promise<HouseholdRequest[]> {
  if (!session.householdId) return [];
  return asPortalUser(session, async (tx) => {
    const rows = await tx.query<{
      id: string; requested_at: string; status: string; note: string | null;
      referral_id: string | null; full_name: string | null;
    }>(
      `SELECT r.id, r.requested_at::text, r.status::text AS status, r.note,
              r.referral_id, p.full_name
         FROM shortlist_requests r
         LEFT JOIN providers p ON p.id = r.provider_id
        ORDER BY r.requested_at DESC`,
    );
    return rows.map((r) => ({
      requestId: r.id,
      providerName: r.full_name ?? 'A provider we put forward',
      requestedOn: r.requested_at.slice(0, 10),
      status: r.status,
      note: r.note,
      referralId: r.referral_id,
    }));
  });
}

/**
 * The status in the household's words.
 *
 * "Referred" is the strongest word available and it is still not "booked", "confirmed"
 * or "placed" — it means an introduction was made after a conversation, which is the
 * whole of what a registry does. § 4.1 bans the other three outright and a test
 * asserts it.
 */
export const REQUEST_STATUS: Record<string, { label: string; detail: string }> = {
  pending: {
    label: 'Requested',
    detail: 'We have it and we will call you.',
  },
  referred: {
    label: 'Introduced',
    detail: 'We made the introduction after speaking with you.',
  },
  declined_by_household: {
    label: 'You decided against it',
    detail: 'No further action, and it is not a problem.',
  },
  withdrawn: {
    label: 'Withdrawn',
    detail: 'This one is no longer going ahead.',
  },
};
