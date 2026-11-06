/**
 * What the household can see of its own statutory record. Web spec § 4.1 and § 2.
 *
 * The two disclosures are the point of this screen. § 1812.5095(f) requires a written
 * statement within three California business days of the referral; § 1812.533(b)(4)
 * requires the nurses' registry disclosure, with the complaint contacts, to reach the
 * patient BEFORE they are under the care of any nursing personnel. A household that can
 * see which of those it has had, and on what date, can hold the registry to them — and
 * a record the subject can check is a stronger record than one only the registry holds.
 *
 * Each `disclosures` row stores `statutory_version`, so what is shown here is the text
 * as it stood when it was delivered, not the current wording. That matters: a
 * compliance record that cannot prove WHICH text was delivered is a weaker record.
 *
 * Alongside those, anything the operator has filed against the family or one of their
 * cases AND deliberately shared. Core migration 0015 holds the bytes; `filedDocuments`
 * below reads the index, and the file itself comes through `/portal/documents/[id]`.
 * Sharing is off by default — the registry's own file is not the family's to read — so
 * this screen shows what someone chose to show them, not everything that exists.
 *
 * STILL NOT HERE: invoices and the LTC claim packet. Both are § 4.1 items and both are
 * downstream of payments, which counsel question 3 blocks — § 687.2(h) is an account
 * structure decision. The screen names them rather than quietly omitting them, so the
 * absence reads as a gap and not as "you have no invoices".
 */
import {
  NURSES_REGISTRY_DISCLOSURE, ORAL_DISCLOSURE, WRITTEN_STATEMENT, COMPLAINT_CONTACTS_DOCUMENT,
  isDeliverable, type StatutoryText,
} from '@/content/statutory';
import { asPortalUser } from './portalDb';
import type { PortalSession } from './session';

export type DocumentState = 'delivered' | 'due' | 'not_applicable';

export interface PortalDocument {
  key: string;
  label: string;
  citation: string;
  /** What the household should understand it to be, in their words not the statute's. */
  plainly: string;
  state: DocumentState;
  /** Delivery date, or the date it is due. */
  on: string | null;
  version: string;
  text: string;
  /**
   * False while the wording is a draft counsel has not approved, or a business fact
   * nobody has supplied. `isDeliverable` is the single definition of that, and the
   * screen must not render the body when this is false — see the note on `doc` below.
   */
  deliverable: boolean;
}

export interface CaseDocuments {
  caseId: string;
  care: string;
  documents: PortalDocument[];
}

interface DisclosureRow {
  id: string;
  case_id: string;
  care: string;
  disclosed_at: string;
  written_due_on: string;
  written_sent_on: string | null;
  nurse_disclosure_required: boolean;
  nurse_disclosure_sent_on: string | null;
  complaint_contacts_sent_on: string | null;
  statutory_version: string;
}

/*
 * Keys are per DISCLOSURE, not per case.
 *
 * A case has one disclosure per referral — `referrals.disclosure_id` is NOT NULL — and
 * a bench puts two or three providers forward, so several disclosures on one case is
 * the normal state rather than an edge. Keying on case_id meant a household referred
 * two providers saw "What we told you on the phone" twice with the same React key and
 * two different dates: duplicate keys, and two identical labels carrying different
 * facts, on a screen whose whole purpose is a record the subject can check.
 */

/**
 * WHY `deliverable` IS CARRIED RATHER THAN ASSUMED.
 *
 * `content/statutory/types.ts` grades every text: 'statute' is reproduced verbatim,
 * 'approved' has counsel behind it, 'draft' does not, and 'unfilled' is a business
 * fact nobody has supplied. `isDeliverable` is the one definition of which may be put
 * in front of somebody, and until now only `StatutoryFooter` consulted it.
 *
 * These screens did not, and the result was worse than it sounds. The § 1812.533(b)(4)
 * complaint contacts are 'unfilled' with an empty body, so a household opening "Where
 * to complain about a nurse" was handed a blank panel — a required disclosure
 * presented as though it existed and said nothing. The nurses' registry disclosure and
 * the provider notice are 'draft' and were shown as settled text.
 *
 * Showing a draft is a worse failure than showing nothing, because the reader has no
 * way to tell. So the body only crosses when it is deliverable, and the screen says
 * plainly what the position is when it is not.
 */
function doc(
  key: string,
  label: string,
  plainly: string,
  source: StatutoryText,
  state: DocumentState,
  on: string | null,
  version: string,
): PortalDocument {
  const deliverable = isDeliverable(source);
  return {
    key, label, plainly, state, on, version, deliverable,
    citation: source.citation,
    text: deliverable ? source.text : '',
  };
}

export async function caseDocuments(session: PortalSession): Promise<CaseDocuments[]> {
  if (!session.householdId) return [];

  const rows = await asPortalUser(session, (tx) => tx.query<DisclosureRow>(
    `SELECT d.id, d.case_id, c.care::text AS care, d.disclosed_at::text,
            d.written_due_on::text, d.written_sent_on::text,
            d.nurse_disclosure_required, d.nurse_disclosure_sent_on::text,
            d.complaint_contacts_sent_on::text, d.statutory_version
       FROM disclosures d
       JOIN cases c ON c.id = d.case_id
      ORDER BY d.disclosed_at DESC`,
  ));

  const byCase = new Map<string, CaseDocuments>();
  for (const row of rows) {
    const entry = byCase.get(row.case_id)
      ?? { caseId: row.case_id, care: row.care, documents: [] };

    entry.documents.push(doc(
      `${row.id}-oral`,
      'What we told you on the phone',
      'The law requires us to say certain things out loud before we refer anyone. '
      + 'This is that text, so you have it in writing too.',
      ORAL_DISCLOSURE,
      'delivered',
      row.disclosed_at.slice(0, 10),
      row.statutory_version,
    ));

    entry.documents.push(doc(
      `${row.id}-written`,
      'Your written statement',
      'The same terms in writing. The law gives us three business days from the '
      + 'referral to get it to you.',
      WRITTEN_STATEMENT,
      row.written_sent_on ? 'delivered' : 'due',
      row.written_sent_on ?? row.written_due_on,
      row.statutory_version,
    ));

    if (row.nurse_disclosure_required) {
      entry.documents.push(doc(
        `${row.id}-nurses-registry`,
        'Nurses’ registry disclosure',
        'Because a nurse is involved, the law requires a separate notice — and it has '
        + 'to reach you before any nursing care starts, not afterwards.',
        NURSES_REGISTRY_DISCLOSURE,
        row.nurse_disclosure_sent_on ? 'delivered' : 'due',
        row.nurse_disclosure_sent_on,
        row.statutory_version,
      ));

      entry.documents.push(doc(
        `${row.id}-complaints`,
        'Where to complain about a nurse',
        'Who to contact if you have a complaint about licensed nursing care, with '
        + 'their addresses and phone numbers. Nothing goes through us.',
        COMPLAINT_CONTACTS_DOCUMENT,
        row.complaint_contacts_sent_on ? 'delivered' : 'due',
        row.complaint_contacts_sent_on,
        row.statutory_version,
      ));
    }

    byCase.set(row.case_id, entry);
  }

  return [...byCase.values()];
}

/**
 * The things § 4.1 lists that have nowhere to live yet. Named on the screen rather than
 * quietly omitted, so the absence reads as a gap rather than as "you have no invoices".
 *
 * The signed service agreement left this list when documents got a home: it is now
 * something the operator files and shares, and it appears below if they have.
 */
export const NOT_YET_IN_THE_PORTAL = [
  'invoices',
  'the long-term care claim packet',
] as const;

export interface FiledDocument {
  id: string;
  filename: string;
  kind: string;
  byteSize: number;
  filedOn: string;
  note: string | null;
  /** Null when it is filed against the family rather than one case. */
  caseId: string | null;
}

/** What the household may read, in the household's words. */
const FILED_LABEL: Record<string, string> = {
  registry_agreement: 'Signed agreement',
  written_notice: 'Written notice',
  written_statement: 'The written statement we sent you',
  nurse_disclosure: 'Nurses’ registry disclosure',
  correspondence: 'Letter',
  credential: 'Document',
  other: 'Document',
};

export function filedLabel(kind: string): string {
  return FILED_LABEL[kind] ?? 'Document';
}

/**
 * Documents the operator filed against this family and chose to share.
 *
 * `bytes` is deliberately not selected. The index is a list; the file comes through the
 * download route one at a time, so a screen listing twelve documents does not pull
 * twelve files out of the database to render their names.
 *
 * Row-level security does the rest: `documents_household_select` requires
 * `visible_to_subject`, an unredacted row, and either the family's own id or one of
 * their cases. There is no WHERE clause here doing that work, because a WHERE clause is
 * something a later edit can drop.
 */
export async function filedDocuments(session: PortalSession): Promise<FiledDocument[]> {
  if (!session.householdId) return [];
  return asPortalUser(session, async (tx) => {
    const rows = await tx.query<{
      id: string; filename: string; kind: string; byte_size: number;
      uploaded_at: string; note: string | null; case_id: string | null;
    }>(
      /*
       * The WHERE narrows; it does not authorise. Both predicates are already required
       * by `documents_household_select`, so dropping them could not widen what comes
       * back — but having them here lets the planner use the partial-index-shaped
       * access path instead of evaluating `household_owns_case()`, a SECURITY DEFINER
       * function, once per row in the table. The ownership test stays in the policy,
       * where a later edit to this file cannot remove it.
       */
      `SELECT id, filename, kind::text AS kind, byte_size,
              uploaded_at::text AS uploaded_at, note, case_id
         FROM documents
        WHERE visible_to_subject AND redacted_at IS NULL
        ORDER BY uploaded_at DESC`,
    );
    return rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      kind: r.kind,
      byteSize: Number(r.byte_size),
      filedOn: r.uploaded_at.slice(0, 10),
      note: r.note,
      caseId: r.case_id,
    }));
  });
}
