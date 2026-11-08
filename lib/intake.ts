/**
 * The three public write paths. Spec § 3.
 *
 * They land in `inquiries` and `provider_applications` and nowhere else. No public path
 * creates a `households`, `cases` or `providers` row — the operator converts from the
 * console. That keeps the entire live record set behind one human, which is both the
 * compliance posture and the product.
 *
 * Nothing here may touch `referrals`, `timeline_entries` or `disclosures`. A test
 * asserts it statically, and in deployment the web project's database role does not
 * hold the privilege either (architecture spec § 4).
 */
import { randomUUID } from 'node:crypto';
import { getDb } from '@h-hallows/core/db';
import { asPortalUser } from './portalDb';
import type { PortalSession } from './session';
import type {
  InquiryInput, PartnerReferralInput, ProviderApplicationInput,
} from './schemas/intake';

const blank = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

/** Enum values are stored as the household chose them; "not_sure" is a real answer. */
const nullIfUnsure = (v: string) => (v === 'not_sure' ? null : v);

export async function recordInquiry(input: InquiryInput): Promise<string> {
  const { query } = await getDb();
  const [row] = await query<{ id: string }>(
    `INSERT INTO inquiries
       (name, phone, email, relationship, care_type, area, pattern_note, start_note,
        urgency, payment_method, message, source_path)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id`,
    [
      input.name.trim(), input.phone.trim(), blank(input.email), input.relationship,
      nullIfUnsure(input.careType), input.area, blank(input.patternNote),
      blank(input.startNote), input.urgency, nullIfUnsure(input.paymentMethod),
      blank(input.message), input.sourcePath,
    ],
  );
  if (!row) throw new Error('inquiry was not recorded');
  return row.id;
}

export async function recordApplication(input: ProviderApplicationInput): Promise<string> {
  const { query } = await getDb();
  const [row] = await query<{ id: string }>(
    `INSERT INTO provider_applications
       (full_name, phone, email, type, license_number, areas, languages, specialties,
        experience_note, message)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id`,
    [
      input.fullName.trim(), input.phone.trim(), input.email.trim(), input.type,
      blank(input.licenseNumber), input.areas, input.languages, input.specialties,
      blank(input.experienceNote), blank(input.message),
    ],
  );
  if (!row) throw new Error('application was not recorded');
  return row.id;
}

/**
 * A partner referral is an inquiry with the partner block attached.
 *
 * The person we will call is the family contact, not the partner — so `name` and
 * `phone` are theirs. The partner's own details go in `referrer`, along with the
 * patient's INITIALS and the consent confirmation. A full patient name is never taken.
 *
 * ATTRIBUTION, and why it needs a session.
 *
 * `partner_referrals()` — the projection the partner portal reads — is scoped by
 * `inquiries.partner_id`. This function never set it, so every referral a partner sent
 * was invisible in their own portal: the page says "Nothing yet. When you send us a
 * patient it will appear here with where it has got to", and it never did. Reproduced
 * against the running app before this was written.
 *
 * It is set only from a signed-in session, never from the email typed into the form.
 * Matching on a typed address would let anyone claim another partner's referrals by
 * knowing their email, and `partner_id` is exactly what decides who may read the
 * outcome later. An anonymous referral stays unattributed until an operator attaches
 * it, which is a judgment and not a string comparison.
 */
export async function recordPartnerReferral(
  input: PartnerReferralInput,
  /** The partner sending it, when one is signed in. */
  session?: PortalSession | null,
): Promise<string> {
  const referrer = {
    partnerName: input.partnerName,
    partnerOrg: input.partnerOrg,
    partnerRole: input.partnerRole,
    partnerPhone: input.partnerPhone,
    partnerEmail: input.partnerEmail,
    patientInitials: input.patientInitials,
    consentConfirmed: input.consentNote,
    confirmedAt: new Date().toISOString(),
  };

  const values = [
    input.contactName.trim(), input.contactPhone.trim(),
    nullIfUnsure(input.careType), input.area, input.urgency,
    blank(input.note), JSON.stringify(referrer),
  ];

  /*
   * The id is generated here, not asked for back.
   *
   * `INSERT ... RETURNING` needs a SELECT policy matching the new row, and migration
   * 0012 deliberately gives a partner none on `inquiries` — that table carries
   * `household_id`, and the mere presence of a value there would tell a partner the
   * family engaged us. So the insert succeeds and the RETURNING is refused, and
   * Postgres reports it as "new row violates row-level security policy", which points
   * at the WITH CHECK and is the wrong place to look. Second time this trap has been
   * hit here; the first was a provider filing a credential document.
   */
  const id = randomUUID();

  const INSERT = `
    INSERT INTO inquiries
      (id, name, phone, relationship, care_type, area, urgency, message, source_path,
       referrer, partner_id)
    VALUES ($9,$1,$2,'professional',$3,$4,$5,$6,'/refer',$7::jsonb,$8)`;

  /*
   * Signed in: written as the partner, so the row is attributed and the § 4 policy is
   * what permits it. Migration 0014 constrains that insert to
   * `partner_id IS NULL OR partner_id = current_partner()`, which means the claim in
   * the session is the only partner_id this path can write — a forged one is refused
   * by the database rather than trusted by this function.
   */
  if (session?.partnerId) {
    await asPortalUser(session, (tx) =>
      tx.query(INSERT, [...values, session.partnerId, id]));
    return id;
  }

  // Nobody signed in. The public path, unattributed, as before.
  const { query } = await getDb();
  await query(INSERT, [...values, null, id]);
  return id;
}
