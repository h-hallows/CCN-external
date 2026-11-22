/**
 * The words the public surface uses for things the database names in enums.
 *
 * WHY THIS EXISTS. Core's `src/domain/care.ts` carries CARE_LABEL and says in its own
 * header why it is shared: "a second copy of CARE_LABEL is how 'Post-surgical' becomes
 * 'Post surgical' on one page." It was right, and there were still eight copies of these
 * lists across the three repositories by the time anybody counted — three of the seven
 * care labels had already drifted.
 *
 * THE PUBLIC WORDING IS DELIBERATELY NOT CORE'S. Core says "Companion", because a
 * console column is read by somebody who already knows what it means. A household
 * reading a form has not met us, and "Companionship" is what they would say. The same
 * goes for "Post-surgical recovery" and "Overnight newborn care", which are also the
 * slugs the crossed landing pages are built on, so changing them would move URLs.
 *
 * What must not differ is the SET. `tests/vocabulary.test.ts` fails if this map's keys
 * are not exactly core's plus `not_sure` — so a care type added to core breaks the build
 * here until somebody chooses the household's wording for it, rather than quietly
 * disappearing from every public form.
 */
import { AREAS, CARE_LABEL as CORE_CARE_LABEL, areaLabel } from '@h-hallows/core/domain';
import type { CareType } from '@h-hallows/core/schema';
import { CARE_TYPES, URGENCIES } from '@/lib/schemas/intake';

export interface Option {
  value: string;
  label: string;
  /** Shown under the option where the label alone would be guessed at. */
  note?: string;
}

/**
 * `not_sure` is a real answer and the most honest one somebody has at four on a Friday.
 * It is stored as a null care type rather than as a value — `lib/intake.ts` does that —
 * so nothing downstream has to know this option exists.
 */
export const PUBLIC_CARE_LABEL: Record<CareType | 'not_sure', string> = {
  companion: 'Companionship',
  personal_care: 'Personal care',
  skilled_nursing: 'Skilled nursing',
  post_surgical: 'Post-surgical recovery',
  overnight_newborn: 'Overnight newborn care',
  respite: 'Respite',
  hospice_support: 'Hospice support',
  not_sure: 'Not sure yet',
};

/** What each one means, for somebody who has never arranged care before. */
export const CARE_NOTE: Partial<Record<CareType | 'not_sure', string>> = {
  companion: 'Company, errands, appointments, keeping the day going.',
  personal_care: 'Bathing, dressing, moving about, medication reminders.',
  skilled_nursing: 'Nursing care under a physician’s direction.',
  post_surgical: 'The first weeks at home after an operation.',
  overnight_newborn: 'Nights, so the household can sleep.',
  respite: 'Cover for the person who is doing it all.',
  hospice_support: 'Support alongside a hospice team, not instead of one.',
};

/** The care options, in the order a household reads them: least clinical first. */
export const CARE_OPTIONS: Option[] = (CARE_TYPES as readonly string[]).map((value) => ({
  value,
  label: PUBLIC_CARE_LABEL[value as CareType | 'not_sure'] ?? value,
  note: CARE_NOTE[value as CareType | 'not_sure'],
}));

/** Derived from core, so the slugs the console converts an enquiry with are these. */
export const AREA_OPTIONS: Option[] = AREAS.map((slug) => ({
  value: slug,
  label: areaLabel(slug),
}));

/** Plain on purpose. Urgency decides how fast we move, not what it costs. */
export const URGENCY_OPTIONS: Option[] = [
  { value: 'discharge', label: 'They are discharging now' },
  { value: 'same_day', label: 'Today' },
  { value: 'next_day', label: 'Tomorrow' },
  { value: 'routine', label: 'In the next week or two' },
];

/** The same four, worded for somebody referring a patient rather than a relative. */
export const PARTNER_URGENCY_OPTIONS: Option[] = [
  { value: 'discharge', label: 'Discharging now' },
  { value: 'same_day', label: 'Today' },
  { value: 'next_day', label: 'Tomorrow' },
  { value: 'routine', label: 'In the next week or two' },
];

export const RELATIONSHIP_OPTIONS: Option[] = [
  { value: 'self', label: 'It is for me' },
  { value: 'spouse', label: 'My husband or wife' },
  { value: 'parent', label: 'My parent' },
  { value: 'child', label: 'My child' },
  { value: 'other_family', label: 'Another relative' },
  { value: 'professional', label: 'I am a professional acting for them' },
  { value: 'other', label: 'Something else' },
];

export const PAYMENT_OPTIONS: Option[] = [
  { value: 'private', label: 'Paying privately' },
  { value: 'ltc_policy', label: 'A long-term care policy' },
  { value: 'va', label: 'Veterans’ benefits' },
  { value: 'not_sure', label: 'Not sure yet' },
];

export const PARTNER_ROLE_OPTIONS: Option[] = [
  { value: 'discharge_planner', label: 'Discharge planner' },
  { value: 'care_manager', label: 'Geriatric care manager' },
  { value: 'physician', label: 'Physician' },
  { value: 'surgical_practice', label: 'Surgical practice' },
  { value: 'attorney', label: 'Attorney' },
  { value: 'family_office', label: 'Family office' },
  { value: 'other', label: 'Something else' },
];

/**
 * What an applicant calls themselves.
 *
 * `licenseNumber` is required for RN and LVN by the schema and by § 1812.528, which asks
 * the registry to inspect the licence itself. The note says so on the form rather than
 * leaving it to a rejection after they press send.
 */
export const PROVIDER_TYPE_OPTIONS: Option[] = [
  { value: 'RN', label: 'Registered nurse', note: 'Licence number required' },
  { value: 'LVN', label: 'Licensed vocational nurse', note: 'Licence number required' },
  { value: 'CNA', label: 'Certified nursing assistant' },
  { value: 'HCA', label: 'Home care aide' },
  { value: 'companion', label: 'Companion or caregiver' },
];

export const LANGUAGE_OPTIONS: string[] = [
  'English', 'Spanish', 'Tagalog', 'Mandarin', 'Cantonese', 'Korean',
  'Farsi', 'Russian', 'French', 'Armenian', 'Hebrew', 'Japanese',
];

/**
 * What somebody has actually done, not what they have been taught.
 *
 * I1: nothing on this site records, offers or tracks training, and a list of
 * certifications to tick would be a competency register with another name. These are
 * kinds of work.
 */
export const SPECIALTY_OPTIONS: Option[] = [
  { value: 'post_surgical', label: 'Post-surgical recovery' },
  { value: 'wound_care', label: 'Wound care' },
  { value: 'medication_management', label: 'Medication management' },
  { value: 'dementia', label: 'Dementia and memory care' },
  { value: 'parkinsons', label: 'Parkinson’s' },
  { value: 'stroke_recovery', label: 'Stroke recovery' },
  { value: 'infusion', label: 'Infusion' },
  { value: 'ostomy', label: 'Ostomy care' },
  { value: 'hospice_support', label: 'Hospice support' },
  { value: 'overnight_newborn', label: 'Newborn and overnight' },
  { value: 'mobility', label: 'Mobility and transfers' },
  { value: 'personal_care', label: 'Personal care' },
];

/** Asserted rather than assumed: the public list must cover core's exactly. */
export const CORE_CARE_KEYS = Object.keys(CORE_CARE_LABEL).sort();
export const PUBLIC_CARE_KEYS = Object.keys(PUBLIC_CARE_LABEL).sort();
export const URGENCY_KEYS = [...URGENCIES].sort();
