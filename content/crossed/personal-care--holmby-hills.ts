import { assertComplete, type CrossedPage } from './types';

export const page: CrossedPage = assertComplete({
  service: 'personal-care',
  area: 'holmby-hills',
  title: 'Personal Care at Home in Holmby Hills',
  summary:
    'Discreet personal care in Holmby Hills, arranged privately and without anything '
    + 'identifying going into an email.',
  localContext: [
    'Holmby Hills households are usually staffed already, and the question is almost '
    + 'never whether anyone is in the house. It is whether the person doing the '
    + 'personal care fits alongside an existing household, which is a matching problem '
    + 'rather than a staffing one.',
    'Discretion here is a practical requirement rather than a preference. We do not put '
    + 'names, addresses or any clinical detail in an email — our own notifications say '
    + 'that something has arrived and nothing about who, and the detail lives behind a '
    + 'login.',
  ],
  commonCases: [
    'Personal care for one member of a household that already has staff, where the '
    + 'boundary between the roles has to be clear from the first day.',
    'A long arrangement where the family wants two people who can cover each other for '
    + 'years rather than a succession of short placements.',
  ],
  questions: [
    {
      q: 'How do you handle confidentiality?',
      a: 'By keeping the sensitive part out of the channels that leak. Nothing '
        + 'identifying goes in an email subject or body, there is no marketing list, '
        + 'and we publish no testimonial that names a household or a provider. A '
        + 'non-disclosure agreement is ordinary here and we will sign yours.',
    },
    {
      q: 'Can care be arranged without the wider household knowing?',
      a: 'Within reason, yes, and it is a common request. What we cannot do is conceal '
        + 'the arrangement from the person receiving the care, who has to be told '
        + 'certain things by law and will be.',
    },
    {
      q: 'Do you work alongside an existing estate manager?',
      a: 'Routinely. Usually the estate manager handles access, scheduling and the '
        + 'household side, and deals with us directly. Tell us who to speak to and we '
        + 'will keep the household out of the logistics entirely.',
    },
    {
      q: 'What do you publish about your clients?',
      a: 'Nothing that identifies anyone. Any testimonial is at household level, never '
        + 'attributed to a named provider, and only with recorded consent that can be '
        + 'withdrawn — at which point it comes down automatically rather than when '
        + 'somebody remembers.',
    },
  ],
  rateKey: 'personal_care',
  reviewedOn: '2026-11-05',
  body: [
    'Personal care in a staffed household is mostly about boundaries. Who does what, '
    + 'who the person reports to, and what happens when those two answers conflict at '
    + 'six in the morning.',
    'We introduce people who have worked in households like this before and understand '
    + 'the difference between being present and being intrusive. You engage whoever you '
    + 'choose directly, and you agree the rate with them.',
    'If you would rather not use the portal at all and handle everything by telephone, '
    + 'that is a perfectly normal request and we will set it up that way.',
  ],
});
