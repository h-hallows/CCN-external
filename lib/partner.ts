/**
 * The partner view. Web build spec § 4.3, W11.
 *
 * Everything a partner reads comes through `partner_referrals()`, a SECURITY DEFINER
 * projection added in migration 0012. There is deliberately no partner SELECT policy
 * on `inquiries`: that table carries `household_id`, and the mere presence of a value
 * there tells the partner the family engaged us — which is exactly the fact § 4.3's
 * "within the limits of household consent" exists to protect. The function returns the
 * columns a partner is entitled to and computes the outcome through the consent gate.
 *
 * NOTHING ABOUT MONEY. No fee, no commission, no rewards balance, no "referrals this
 * quarter" leaderboard. § 1812.531 forbids a nurses' registry dividing fees with a
 * physician, surgeon, nurse, hospital, patient or their agents, which covers most of
 * the people this portal is for. A test asserts no such column exists in the schema
 * and no such word appears in this surface.
 */
import { asPortalUser } from './portalDb';
import type { PortalSession } from './session';

export interface PartnerReferral {
  inquiryId: string;
  receivedOn: string;
  patientInitials: string | null;
  careType: string | null;
  area: string | null;
  urgency: string | null;
  contactName: string;
  /** When we picked it up. About us, so it needs no consent. */
  acknowledgedOn: string | null;
  /** Null unless the household has agreed we may say. */
  outcome: string | null;
}

export async function partnerReferrals(
  session: PortalSession,
): Promise<PartnerReferral[]> {
  if (!session.partnerId) return [];
  return asPortalUser(session, async (tx) => {
    const rows = await tx.query<{
      inquiry_id: string; received_at: string; patient_initials: string | null;
      care_type: string | null; area: string | null; urgency: string | null;
      contact_name: string; acknowledged_at: string | null; outcome: string | null;
    }>(
      // Columns listed and timestamps cast, rather than SELECT *. The driver hands
      // back a Date for a timestamptz, and String(date).slice(0, 10) is "Thu Nov 05"
      // — which rendered next to ISO dates everywhere else in the portal and would
      // not survive being parsed. Every other module in this app casts at the
      // boundary for the same reason; this one did not.
      `SELECT inquiry_id, received_at::text, patient_initials, care_type, area,
              urgency, contact_name, acknowledged_at::text, outcome
         FROM partner_referrals()`,
    );

    return rows.map((r) => ({
      inquiryId: r.inquiry_id,
      receivedOn: r.received_at.slice(0, 10),
      patientInitials: r.patient_initials,
      careType: r.care_type,
      area: r.area,
      urgency: r.urgency,
      contactName: r.contact_name,
      acknowledgedOn: r.acknowledged_at ? r.acknowledged_at.slice(0, 10) : null,
      outcome: r.outcome,
    }));
  });
}

/**
 * What a partner is told, in plain words.
 *
 * "We are still on it" is the honest answer for most of these, and the honest answer
 * where the household has not agreed to share anything. Saying so beats inventing a
 * status that implies more than we may tell them.
 */
export function referralStanding(r: PartnerReferral): string {
  if (r.outcome === 'care_arranged') return 'Care was arranged';
  if (r.acknowledgedOn) return 'We have spoken to them';
  return 'With us, not yet picked up';
}

export const OUTCOME_NOTE =
  'Where a family has told us we may share how it went, you will see that here. '
  + 'Where they have not, you will not — that is their call rather than ours, and it '
  + 'can be withdrawn at any time.';
