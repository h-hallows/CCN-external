/**
 * The provider's own record. Web build spec § 4.2, W8.
 *
 * Everything here runs through `asPortalUser`, which drops to the non-owning `ccn_app`
 * role and sets the provider's claims, so `providers_own_select` / `providers_own_update`
 * decide what is reachable. On top of the policies, migration 0003's
 * `providers_provider_update_guard` names the columns a provider may NOT change —
 * status, areas, full_name, type, licence, the agreement and verification dates — and
 * raises on any statement that touches them, whatever this module sends.
 *
 * WHAT IS ABSENT HERE IS THE PRODUCT. No suggested rate, no market comparison, no
 * "providers near you charge", no cap, no floor, no validation beyond a positive
 * number (I5, § 1812.5095(b)(3), § 687.2(c)). No acceptance-rate metric, no response
 * time, no score, no badge, no course, no completion tracking (I1, I2, I8). A registry
 * that scored its providers would be managing them, and a managed provider is an
 * employee.
 */
import { credStatus, eligibility, requiredFor, LABEL } from '@h-hallows/core/domain';
import type { CredentialType, ProviderType } from '@h-hallows/core/schema';
import { asPortalUser } from './portalDb';
import type { PortalSession } from './session';

export interface ProviderSelf {
  providerId: string;
  fullName: string;
  preferredName: string | null;
  type: ProviderType;
  bio: string | null;
  phone: string | null;
  email: string | null;
  photoUrl: string | null;
  photoConsentOn: string | null;
  rateHourly: string | null;
  rateNotes: string | null;
  availability: string[];
  restrictions: string | null;
  transports: boolean;
  status: string;
  specialties: string[];
  languages: string[];
  areas: string[];
  /**
   * The state the licence is held in, never the number. A résumé reading "RN,
   * California" is useful; a licence number on a document the provider will email
   * around is a gift to anyone who wants to impersonate them.
   */
  licenseState: string | null;
  /** Recorded when the referral agreement was signed. § 1812.5095(b)(1). */
  agreementSignedOn: string | null;
  /** Recorded when the § 1812.5095(d) notice was acknowledged. */
  writtenNoticeAckOn: string | null;
}

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'invalid' | 'refused' | 'failed'; message?: string };

interface SelfRow {
  id: string; full_name: string; preferred_name: string | null; type: string;
  bio: string | null; phone: string | null; email: string | null;
  photo_url: string | null; photo_consent_on: string | null;
  rate_hourly: string | null; rate_notes: string | null;
  availability: string[] | null; restrictions: string | null;
  transports: boolean; status: string;
  specialties: string[] | null; languages: string[] | null; areas: string[] | null;
  license_state: string | null;
  agreement_signed_on: string | null; written_notice_ack_on: string | null;
}

export async function providerSelf(session: PortalSession): Promise<ProviderSelf | null> {
  if (!session.providerId) return null;
  return asPortalUser(session, async (tx) => {
    const rows = await tx.query<SelfRow>(
      `SELECT id, full_name, preferred_name, type::text AS type, bio, phone, email,
              photo_url, photo_consent_on::text, rate_hourly::text, rate_notes,
              availability, restrictions, transports, status::text AS status,
              specialties, languages, areas, license_state,
              agreement_signed_on::text, written_notice_ack_on::text
         FROM providers WHERE id = $1`,
      [session.providerId],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      providerId: r.id,
      fullName: r.full_name,
      preferredName: r.preferred_name,
      type: r.type as ProviderType,
      bio: r.bio,
      phone: r.phone,
      email: r.email,
      photoUrl: r.photo_url,
      photoConsentOn: r.photo_consent_on,
      rateHourly: r.rate_hourly,
      rateNotes: r.rate_notes,
      availability: r.availability ?? [],
      restrictions: r.restrictions,
      transports: r.transports,
      status: r.status,
      specialties: r.specialties ?? [],
      languages: r.languages ?? [],
      areas: r.areas ?? [],
      licenseState: r.license_state,
      agreementSignedOn: r.agreement_signed_on,
      writtenNoticeAckOn: r.written_notice_ack_on,
    };
  });
}

/** Shared shape for the four small provider-authored updates. */
async function updateSelf(
  session: PortalSession,
  sql: string,
  params: unknown[],
): Promise<SaveResult> {
  if (!session.providerId) return { ok: false, reason: 'not_found' };
  try {
    const rows = await asPortalUser(session, (tx) => tx.query<{ id: string }>(
      `${sql} WHERE id = $1 RETURNING id`, [session.providerId, ...params],
    ));
    return rows.length > 0 ? { ok: true } : { ok: false, reason: 'not_found' };
  } catch (err) {
    // A guard-trigger refusal lands here. It means this module tried to write a column
    // a provider may not, which is a bug in this file rather than in the request.
    console.error('[pro] update refused', err);
    return { ok: false, reason: 'refused' };
  }
}

export const BIO_MAX = 2000;
export const RESTRICTIONS_MAX = 1000;
export const RATE_NOTES_MAX = 500;

export async function saveProviderProfile(
  session: PortalSession,
  input: { preferredName: string; bio: string; phone: string; email: string },
): Promise<SaveResult> {
  if (input.bio.length > BIO_MAX) return { ok: false, reason: 'invalid' };
  const blank = (v: string) => (v.trim() === '' ? null : v.trim());
  return updateSelf(
    session,
    `UPDATE providers SET preferred_name = $2, bio = $3, phone = $4, email = $5`,
    [blank(input.preferredName), blank(input.bio), blank(input.phone), blank(input.email)],
  );
}

/**
 * The rate. I5 lives here.
 *
 * The only rule is that a number must be a positive number. There is no maximum,
 * because a cap is the registry setting the rate; no minimum, because a floor is the
 * registry setting the rate; and no suggestion, because a default anchors it. Clearing
 * it is allowed — a provider who would rather discuss it is stating something too.
 */
export async function saveRate(
  session: PortalSession,
  input: { rateHourly: string; rateNotes: string },
): Promise<SaveResult> {
  const raw = input.rateHourly.trim();
  let rate: number | null = null;
  if (raw !== '') {
    rate = Number(raw);
    if (!Number.isFinite(rate) || rate <= 0) {
      return {
        ok: false, reason: 'invalid',
        message: 'A rate needs to be a number above zero. Leave it empty if you would rather discuss it.',
      };
    }
  }
  if (input.rateNotes.length > RATE_NOTES_MAX) return { ok: false, reason: 'invalid' };
  return updateSelf(
    session,
    `UPDATE providers SET rate_hourly = $2, rate_notes = $3`,
    [rate, input.rateNotes.trim() === '' ? null : input.rateNotes.trim()],
  );
}

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const BLOCKS = ['AM', 'PM', 'NOC'] as const;
export const BLOCK_LABEL: Record<string, string> = {
  AM: 'Morning', PM: 'Afternoon', NOC: 'Overnight',
};

const VALID_SLOT = new Set(DAYS.flatMap((d) => BLOCKS.map((b) => `${d}:${b}`)));

/**
 * Availability, editable at any time and with no notice period.
 *
 * A registry that required a provider to give notice before changing when they are
 * open to work would be controlling their hours, which is § 687.2(b) and (e). So an
 * empty week is a valid answer and saves like any other.
 */
export async function saveAvailability(
  session: PortalSession,
  slots: string[],
): Promise<SaveResult> {
  const clean = [...new Set(slots)].filter((s) => VALID_SLOT.has(s)).sort();
  return updateSelf(session, `UPDATE providers SET availability = $2::text[]`, [clean]);
}

/**
 * What they will not take on, in their own words. Shown to households verbatim —
 * never paraphrased, summarised or categorised into a tag list, because the point of
 * (b)(2) is that the limits are the provider's own and stay legible as such.
 */
export async function saveLimits(
  session: PortalSession,
  restrictions: string,
): Promise<SaveResult> {
  if (restrictions.length > RESTRICTIONS_MAX) return { ok: false, reason: 'invalid' };
  return updateSelf(
    session,
    `UPDATE providers SET restrictions = $2`,
    [restrictions.trim() === '' ? null : restrictions.trim()],
  );
}

/**
 * A photo and its consent, in one statement or not at all.
 *
 * `providers_photo_requires_consent` CHECKs that a photo_url cannot exist without a
 * photo_consent_on, so there is no sequence of statements that leaves a photograph of
 * somebody on file with no record of them agreeing to it. Removing the photo clears
 * both.
 */
export async function savePhoto(
  session: PortalSession,
  input: { photoUrl: string; consent: boolean },
): Promise<SaveResult> {
  const url = input.photoUrl.trim();
  if (url === '') {
    return updateSelf(
      session, `UPDATE providers SET photo_url = NULL, photo_consent_on = NULL`, []);
  }
  if (!input.consent) {
    return {
      ok: false, reason: 'invalid',
      message: 'We need you to agree to it being shown before we can store it.',
    };
  }
  return updateSelf(
    session,
    // LA's date, for the same reason as the schedule window: current_date is the
    // server's, and a consent recorded as dated tomorrow is a worse record than one
    // dated today.
    `UPDATE providers SET photo_url = $2,
            photo_consent_on = (now() AT TIME ZONE 'America/Los_Angeles')::date`,
    [url],
  );
}

// ---------------------------------------------------------------------------
// Credentials: what is on file, what is missing, and what has been handed in.
// ---------------------------------------------------------------------------

export interface CredentialStanding {
  type: CredentialType;
  label: string;
  required: boolean;
  /** 'none' when nothing is on file for this type. */
  state: 'missing' | 'expired' | 'critical' | 'soon' | 'upcoming' | 'valid' | 'none';
  expiresOn: string | null;
  verifiedOn: string | null;
  /** Set when something has been handed in and not yet turned into a credential. */
  submittedAt: string | null;
  submissionState: string | null;
}

export interface ProviderStanding {
  eligible: boolean;
  /** The types still blocking referral. The provider may see their own, unlike a household. */
  blocking: CredentialType[];
  credentials: CredentialStanding[];
}

export async function credentialStanding(
  session: PortalSession,
  now = new Date(),
  /**
   * The provider row, when the caller already has it. /pro renders both this and the
   * profile summary, so without it the same twenty-column row was fetched twice in
   * two separate transactions to read four fields.
   */
  known?: ProviderSelf | null,
): Promise<ProviderStanding | null> {
  const self = known ?? await providerSelf(session);
  if (!self) return null;

  return asPortalUser(session, async (tx) => {
    const creds = await tx.query<{
      type: string; expires_on: string | null; verified_on: string;
    }>(
      `SELECT type::text AS type, expires_on::text, verified_on::text
         FROM credentials WHERE provider_id = $1 AND deleted_at IS NULL`,
      [self.providerId],
    );
    const submissions = await tx.query<{ type: string; submitted_at: string; state: string }>(
      `SELECT type::text AS type, submitted_at::text, state::text AS state
         FROM credential_submissions
        WHERE provider_id = $1
        ORDER BY submitted_at DESC`,
      [self.providerId],
    );

    const required = requiredFor({ type: self.type, transports: self.transports });
    const standing = eligibility(
      { type: self.type, transports: self.transports, status: self.status as never },
      creds.map((c) => ({ type: c.type as CredentialType, expiresOn: c.expires_on })),
      now,
    );

    const types = [...new Set<CredentialType>([
      ...required,
      ...creds.map((c) => c.type as CredentialType),
      ...submissions.map((s) => s.type as CredentialType),
    ])];

    return {
      eligible: standing.eligible,
      blocking: standing.blocking,
      credentials: types.map((type) => {
        const held = creds.find((c) => c.type === type);
        const handedIn = submissions.find((s) => s.type === type && s.state === 'submitted');
        return {
          type,
          label: LABEL[type] ?? type,
          required: required.includes(type),
          state: held ? credStatus(held.expires_on, now) : 'missing',
          expiresOn: held?.expires_on ?? null,
          verifiedOn: held?.verified_on ?? null,
          submittedAt: handedIn?.submitted_at.slice(0, 10) ?? null,
          submissionState: handedIn?.state ?? null,
        };
      }),
    };
  });
}

/**
 * Hand something in. This does NOT create a credential and cannot be made to.
 *
 * Migration 0008 dropped the provider INSERT policy on `credentials` after it was
 * found that a provider could insert their own Live Scan and become eligible —
 * `eligibility()` counts the presence of a row of the required type as that
 * requirement being met. Submissions are a different table that nothing computes
 * eligibility from, and the operator creates the verified row.
 */
export async function submitCredential(
  session: PortalSession,
  input: { type: string; identifier: string; documentUrl: string; note: string },
): Promise<SaveResult> {
  if (!session.providerId) return { ok: false, reason: 'not_found' };
  const blank = (v: string) => (v.trim() === '' ? null : v.trim());
  try {
    await asPortalUser(session, (tx) => tx.query(
      // No state, no reviewed_at, no reviewed_by, no credential_id. The policy's
      // WITH CHECK refuses them anyway; not naming them means this statement cannot
      // drift into claiming something has been checked.
      `INSERT INTO credential_submissions (provider_id, type, identifier, document_url, note)
       VALUES ($1, $2::credential_type, $3, $4, $5)`,
      [session.providerId, input.type, blank(input.identifier),
        blank(input.documentUrl), blank(input.note)],
    ));
    return { ok: true };
  } catch (err) {
    console.error('[pro] submission refused', err);
    return { ok: false, reason: 'failed' };
  }
}
