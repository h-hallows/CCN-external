import { assertComplete, type CrossedPage } from './types';

export const page: CrossedPage = assertComplete({
  service: 'skilled-nursing',
  area: 'century-city',
  title: 'Private Nursing at Home in Century City',
  summary:
    'Registered and vocational nurses referred for one-to-one care in Century City. '
    + 'A registry, not an agency: you engage the nurse directly.',
  localContext: [
    'Century City is mostly high-rise, which changes the practical questions more than '
    + 'people expect. Service lifts, loading-dock hours and a front desk that needs a '
    + 'name on a list all decide whether a nurse arriving for a seven o’clock shift '
    + 'gets upstairs at seven or at half past.',
    'Buildings here tend to have a concierge and a management office, so access is '
    + 'usually solvable in one conversation rather than by handing out keys. We ask '
    + 'about it before the first shift because it is the single most common reason a '
    + 'first morning goes badly.',
  ],
  commonCases: [
    'Infusion and central-line care at home for someone who would otherwise be making '
    + 'repeated trips across town for an hour of treatment.',
    'Complex medication regimes after a cardiac or oncology admission, where the family '
    + 'wants a nurse rather than a caregiver because the dosing is not stable yet.',
  ],
  questions: [
    {
      q: 'What is the difference between a nurse and a caregiver here?',
      a: 'A registered or vocational nurse can do things a caregiver cannot: wound '
        + 'care, injections, infusion, assessment of a change in condition. If the '
        + 'work is bathing, meals, company and mobility, a caregiver is the right '
        + 'person and the nursing credential is not the thing you are paying for.',
    },
    {
      q: 'Do you need a doctor’s order?',
      a: 'For skilled nursing, yes — we will not put a nurse forward for clinical work '
        + 'without an ordering physician on the record. It protects the nurse as much '
        + 'as the patient, and the system will not let us past that step.',
    },
    {
      q: 'What extra disclosures apply to a nurse?',
      a: 'Nursing referrals fall under a different chapter of the Civil Code from '
        + 'caregiver referrals, and it requires a written notice reaching the patient '
        + 'before any nursing care begins — not afterwards. You will get that document, '
        + 'with the complaint contacts on it, before the first shift.',
    },
    {
      q: 'Can a nurse cover overnight in a building with no guest parking?',
      a: 'Usually, but it has to be arranged rather than assumed. Overnight shifts in '
        + 'high-rise buildings turn on where the car goes and which lift runs after '
        + 'hours. Tell us the building when you call and we will ask the right '
        + 'questions first.',
    },
  ],
  rateKey: 'skilled_nursing',
  reviewedOn: '2026-11-05',
  body: [
    'This is one nurse, in your home, working for you. It is not a '
    + 'visiting service on a schedule set by somebody else, and it is not a clinical '
    + 'programme we design. You decide what you need and the nurse you engage carries '
    + 'it out.',
    'We check every nursing licence against the issuing board rather than against a '
    + 'copy handed to us, and we record the expiry so we know before you do. A nurse '
    + 'whose clearance has lapsed comes off every short list automatically; there is no '
    + 'override for that, for anyone.',
    'If you are not sure whether the work needs a nurse at all, say so when you call. '
    + 'Talking you down to a caregiver is a perfectly normal outcome of that '
    + 'conversation.',
  ],
});
