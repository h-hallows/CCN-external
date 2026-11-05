import { assertComplete, type CrossedPage } from './types';

export const page: CrossedPage = assertComplete({
  service: 'skilled-nursing',
  area: 'bel-air',
  title: 'Nursing Care at Home in Bel Air',
  summary:
    'Registered and vocational nurses referred for care at home in Bel Air, with the '
    + 'disclosures the law requires before care begins.',
  localContext: [
    'Bel Air is hillside and gated, and both facts change the practical arrangement. '
    + 'Gate codes, a long drive and no mobile signal in parts of the canyon are not '
    + 'details — they are what decides whether someone can call for help at two in the '
    + 'morning, so we ask about them before the first shift rather than after it.',
    'Properties here are large enough that a nurse can be genuinely out of earshot of '
    + 'the rest of the household. Where that is the case the arrangement usually needs '
    + 'a working intercom or a monitor, and it is worth sorting out on day one.',
  ],
  commonCases: [
    'Someone returning home after a long admission with equipment, where the family '
    + 'wants a nurse present while they learn to manage it themselves.',
    'Long-running conditions needing regular skilled attention, where the household '
    + 'would rather engage two nurses it knows than accept a rotating schedule from '
    + 'somewhere else.',
  ],
  questions: [
    {
      q: 'What has to happen before a nurse starts?',
      a: 'Three things. There has to be an ordering physician on the record, we have '
        + 'to go through the required disclosure with you by phone or in person, and '
        + 'the written nursing notice with the complaint contacts has to reach the '
        + 'patient before care begins — not within a few days afterwards.',
    },
    {
      q: 'Can you arrange cover around the clock?',
      a: 'Yes, with a named regular and named alternates rather than whoever is '
        + 'available. We aim for two people the household has actually met so a gap can '
        + 'be covered by a familiar face. We will tell you as soon as we know about a '
        + 'gap, not once we have solved it.',
    },
    {
      q: 'Who do we complain to if something goes wrong?',
      a: 'For anything about a licensed nurse, the local district attorney and the '
        + 'Department of Consumer Affairs — not us. Their addresses and phone numbers '
        + 'are in the written notice you get before care starts, and nothing is routed '
        + 'through us first.',
    },
    {
      q: 'Do you check the licence yourselves?',
      a: 'Yes, against the issuing board rather than a copy handed to us, and we also '
        + 'physically inspect the licence and note its expiry. Both are recorded, and a '
        + 'nurse whose clearance lapses comes off every short list automatically.',
    },
  ],
  rateKey: 'skilled_nursing',
  reviewedOn: '2026-11-05',
  body: [
    'A nurse at home is a different arrangement from a caregiver, legally as well as '
    + 'practically. Nursing referrals sit under their own chapter of the Civil Code, '
    + 'with obligations that have no equivalent on the caregiver side — a posted fee '
    + 'schedule, an assignment record, and a written notice that must reach the patient '
    + 'before any nursing care begins.',
    'We deliver both sets of disclosures on every referral rather than deciding case by '
    + 'case which chapter applies. One extra document costs nothing and removes the '
    + 'question entirely.',
    'You engage the nurse directly and agree the rate with them. We charge our fee to '
    + 'the household as a percentage of the job, and nothing is ever deducted from what '
    + 'the nurse is paid.',
  ],
});
