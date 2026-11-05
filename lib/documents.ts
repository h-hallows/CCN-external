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
 * NOT HERE, because nothing models them yet: the signed service agreement, invoices and
 * the LTC claim packet. § 4.1 lists all three. There is no table for a document of any
 * kind — the architecture spec's § 9 schema additions do not include one — and
 * inventing a store plus its retention rules is a decision to take deliberately rather
 * than in passing. The screen says so rather than pretending the list is complete.
 */
import {
  NURSES_REGISTRY_DISCLOSURE, ORAL_DISCLOSURE, WRITTEN_STATEMENT, COMPLAINT_CONTACTS_DOCUMENT,
  type StatutoryText,
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
}

export interface CaseDocuments {
  caseId: string;
  care: string;
  documents: PortalDocument[];
}

interface DisclosureRow {
  case_id: string;
  care: string;
  disclosed_at: string;
  method: string;
  written_due_on: string;
  written_sent_on: string | null;
  nurse_disclosure_required: boolean;
  nurse_disclosure_sent_on: string | null;
  complaint_contacts_sent_on: string | null;
  statutory_version: string;
}

function doc(
  key: string,
  label: string,
  plainly: string,
  source: StatutoryText,
  state: DocumentState,
  on: string | null,
  version: string,
): PortalDocument {
  return {
    key, label, plainly, state, on, version,
    citation: source.citation,
    text: source.text,
  };
}

export async function caseDocuments(session: PortalSession): Promise<CaseDocuments[]> {
  if (!session.householdId) return [];

  const rows = await asPortalUser(session, (tx) => tx.query<DisclosureRow>(
    `SELECT d.case_id, c.care::text AS care, d.disclosed_at::text, d.method,
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
      `${row.case_id}-oral`,
      'What we told you on the phone',
      'The law requires us to say certain things out loud before we refer anyone. '
      + 'This is that text, so you have it in writing too.',
      ORAL_DISCLOSURE,
      'delivered',
      row.disclosed_at.slice(0, 10),
      row.statutory_version,
    ));

    entry.documents.push(doc(
      `${row.case_id}-written`,
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
        `${row.case_id}-nurses-registry`,
        'Nurses’ registry disclosure',
        'Because a nurse is involved, the law requires a separate notice — and it has '
        + 'to reach you before any nursing care starts, not afterwards.',
        NURSES_REGISTRY_DISCLOSURE,
        row.nurse_disclosure_sent_on ? 'delivered' : 'due',
        row.nurse_disclosure_sent_on,
        row.statutory_version,
      ));

      entry.documents.push(doc(
        `${row.case_id}-complaints`,
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
 */
export const NOT_YET_IN_THE_PORTAL = [
  'your signed service agreement',
  'invoices',
  'the long-term care claim packet',
] as const;
