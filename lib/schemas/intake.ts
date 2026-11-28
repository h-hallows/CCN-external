/**
 * Intake schemas. Web build spec § 3.1.
 *
 * All three are `.strict()`: an unknown key is a rejection, not a silently dropped
 * field. These are the only public write paths into a database holding health-adjacent
 * information about private individuals, and "we ignored what we did not recognise" is
 * not a posture worth having at that boundary.
 */
import { z } from 'zod';

/*
 * EVERY RULE CARRIES ITS OWN SENTENCE, BECAUSE THE DEFAULT ONE IS NOT ENGLISH.
 *
 * Only `phone` and the licence refinement had a message. Everything else — every
 * `min`, every `max`, every `email`, every enum — fell through to Zod's default, so the
 * enquiry form, on the door this business runs on, answered a household with
 *
 *   Error: String must contain at least 2 character(s)
 *
 * on a site whose entire register is careful plain English written for people who are
 * frightened and in a hurry. It was measured in a browser, not guessed at.
 *
 * The messages say what to do rather than what was wrong, name nothing the reader did
 * not type, and never blame. They are the only place in the application a refusal is
 * phrased, so they are phrased here once rather than translated near the form, where
 * the next field would be written without one.
 */

/** Pick one of these. Used for every enum, which otherwise prints its own slugs back. */
const choose = (what: string) => ({
  errorMap: () => ({ message: `Choose ${what}.` }),
});

/** A length ceiling nobody should ever meet, phrased for the one person who does. */
const ceiling = (what: string) => `That is more ${what} than this box takes. `
  + 'A shorter version is fine — there is room for the rest on the call.';

const phone = z.string().trim()
  .min(7, 'That looks too short for a number we could call.')
  .max(32, 'That looks too long for a telephone number.')
  .regex(/^[\d\s()+.\-]+$/, 'Enter a phone number we can call');

const optionalEmail = z.string().trim()
  .email('That email address looks incomplete. You can also leave it blank.')
  .max(200, 'That email address is longer than we can store.')
  .optional().or(z.literal(''));

export const CARE_TYPES = [
  'companion', 'personal_care', 'skilled_nursing', 'post_surgical',
  'overnight_newborn', 'respite', 'hospice_support', 'not_sure',
] as const;

export const AREAS = [
  'century_city', 'beverly_hills', 'westwood', 'brentwood', 'bel_air',
  'holmby_hills', 'santa_monica', 'pacific_palisades', 'malibu', 'other',
] as const;

export const URGENCIES = ['discharge', 'same_day', 'next_day', 'routine'] as const;

export const InquirySchema = z.object({
  name: z.string().trim()
    .min(2, 'Tell us what to call you — a first name is enough.')
    .max(120, ceiling('name')),
  phone,
  email: optionalEmail,
  relationship: z.enum([
    'self', 'spouse', 'parent', 'child', 'other_family', 'professional', 'other',
  ], choose('who this is for')),
  careType: z.enum(CARE_TYPES, choose('the kind of care that fits best')),
  area: z.enum(AREAS, choose('the area they are in')),
  patternNote: z.string().trim().max(400, ceiling('detail')).optional(),
  startNote: z.string().trim().max(200, ceiling('detail')).optional(),
  urgency: z.enum(URGENCIES, choose('when it is needed')),
  paymentMethod: z.enum(
    ['private', 'ltc_policy', 'va', 'not_sure'],
    choose('how it is likely to be paid for, or "not sure"'),
  ),
  message: z.string().trim().max(2000, ceiling('detail')).optional(),
  sourcePath: z.string().max(300),                      // hidden; which page it came from
  honeypot: z.literal('').optional(),
}).strict();

export type InquiryInput = z.infer<typeof InquirySchema>;

export const ProviderApplicationSchema = z.object({
  fullName: z.string().trim()
    .min(2, 'We need your name as it appears on your licence or certificate.')
    .max(120, ceiling('name')),
  phone,
  email: z.string().trim()
    .email('That email address looks incomplete — it is how we reply.')
    .max(200, 'That email address is longer than we can store.'),
  type: z.enum(['RN', 'LVN', 'CNA', 'HCA', 'companion'], choose('what you are licensed or certified as')),
  licenseNumber: z.string().trim().max(60, 'That is longer than a licence number.').optional(),
  areas: z.array(z.string())
    .min(1, 'Tick at least one area you would genuinely travel to.')
    .max(9, 'That is more areas than we cover.'),
  languages: z.array(z.string())
    .min(1, 'Tick at least one language you work in.')
    .max(8, 'Tick the eight you are most comfortable working in.'),
  specialties: z.array(z.string()).max(12, 'Tick the twelve that describe your work best.'),
  experienceNote: z.string().trim().max(1200, ceiling('detail')).optional(),
  message: z.string().trim().max(2000, ceiling('detail')).optional(),
  honeypot: z.literal('').optional(),
}).strict()
  .refine((v) => !['RN', 'LVN'].includes(v.type) || Boolean(v.licenseNumber), {
    path: ['licenseNumber'],
    message: 'A licence number is required for RN and LVN applications',
  });

export type ProviderApplicationInput = z.infer<typeof ProviderApplicationSchema>;

/**
 * Initials, not a name.
 *
 * A discharge planner submitting a full patient name and condition to a third party
 * before the family has engaged anyone is a privacy problem for the planner, not just
 * for us. We take initials plus a family contact; the operator gets the rest on the
 * call. `consentNote` records that the partner confirms the family agreed their details
 * could be passed on.
 */
export const PartnerReferralSchema = z.object({
  partnerName: z.string().trim()
    .min(2, 'We need your name — the acknowledgement comes back to a person.')
    .max(120, ceiling('name')),
  partnerOrg: z.string().trim().max(160, ceiling('text')),
  partnerRole: z.enum([
    'discharge_planner', 'care_manager', 'physician', 'surgical_practice',
    'attorney', 'family_office', 'other',
  ], choose('the one closest to your role')),
  partnerPhone: phone,
  partnerEmail: z.string().trim()
    .email('That email address looks incomplete — it is how we come back to you.')
    .max(200, 'That email address is longer than we can store.'),
  patientInitials: z.string().trim()
    .min(1, 'Initials are enough, and they are all we want at this stage.')
    .max(8, 'Initials only, please — not a name. The rest belongs on the call.'),
  careType: z.enum(CARE_TYPES, choose('the kind of care that fits best')),
  area: z.string().max(60, ceiling('text')),
  urgency: z.enum(URGENCIES, choose('when it is needed')),
  contactName: z.string().trim()
    .min(2, 'We need a name for the family member we should call.')
    .max(120, ceiling('name')),
  contactPhone: phone,
  note: z.string().trim().max(1200, ceiling('detail')).optional(),
  /*
   * The one refusal on this form that is not about a typo, so it does not read like
   * one. Until this commit it could not be reached at all: the checkbox carries native
   * `required`, so the browser blocked the press, and the server never saw the case.
   */
  consentNote: z.literal(true, {
    errorMap: () => ({
      message: 'We can only take a referral once you confirm the family agreed their '
        + 'details could be passed on.',
    }),
  }),
  honeypot: z.literal('').optional(),
}).strict();

export type PartnerReferralInput = z.infer<typeof PartnerReferralSchema>;

/**
 * What we tell someone who has just submitted. Spec § 3.2.
 *
 * Only promise what the operator will actually do. A missed callback on a discharge is
 * the worst first impression this business can make, so if the window is not staffed,
 * soften the copy rather than breach it.
 */
export const CONFIRMATION: Record<(typeof URGENCIES)[number], string> = {
  discharge: "We've got this. Someone will call you within the hour.",
  same_day: "We've got this. Someone will call you within the hour.",
  next_day: "Received. We'll call you today.",
  routine: "Received. We'll call you within one business day.",
};
