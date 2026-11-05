import { assertComplete, type CrossedPage } from './types';

export const page: CrossedPage = assertComplete({
  service: 'respite-care',
  area: 'malibu',
  title: 'Respite Care in Malibu',
  summary:
    'Cover so a family carer in Malibu can stop for a day, a weekend or a fortnight, '
    + 'without rearranging everything.',
  localContext: [
    'Malibu is a long drive from almost everywhere the people who do this work live, '
    + 'and the coast road is unpredictable. That makes short shifts impractical here in '
    + 'a way they are not elsewhere — respite in Malibu usually works best as whole '
    + 'days or overnight blocks rather than three hours on a Tuesday.',
    'Fire season and road closures are a real planning constraint rather than a '
    + 'footnote. Anyone covering here needs to know the evacuation arrangement for the '
    + 'house and who to call, and we would rather that conversation happened when '
    + 'nothing is burning.',
  ],
  commonCases: [
    'A spouse who has been the sole carer for a year and has stopped going to their '
    + 'own appointments, taking two days a week back.',
    'A fortnight of cover so the family can travel, usually with the same two people '
    + 'across the whole period rather than a rota.',
  ],
  questions: [
    {
      q: 'How short can respite be?',
      a: 'Practically, a full day out here rather than a couple of hours, because the '
        + 'travel makes short shifts unworkable for the person covering. Closer in we '
        + 'can do shorter. We would rather say that plainly than quote you something '
        + 'nobody will reliably turn up for.',
    },
    {
      q: 'Can the same person cover a two-week absence?',
      a: 'Not alone — nobody should work fourteen days straight, and we will not '
        + 'arrange it. For a fortnight we would put forward two people who both meet '
        + 'the household first, so there is a familiar face throughout.',
    },
    {
      q: 'What does the person covering need to know?',
      a: 'More than people expect, which is why the household writes it down. The '
        + 'routine, how to get in, what the days look like, what matters at three in '
        + 'the morning. You write it in your own words and it goes to whoever covers; '
        + 'we do not rewrite or summarise it.',
    },
    {
      q: 'Is respite cover different from regular care?',
      a: 'Only in how it is arranged. The checks are identical and the work is often '
        + 'the same. What differs is that the person is stepping into an established '
        + 'routine rather than building one, so the handover matters much more than it '
        + 'usually does.',
    },
  ],
  rateKey: 'respite',
  reviewedOn: '2026-11-05',
  body: [
    'Respite is for the carer, not the patient, and that is worth saying out loud. The '
    + 'person who needs this is usually the one insisting they are fine.',
    'The arrangement is the same as any other referral: we put forward people whose '
    + 'clearances we have checked against the issuing body, you meet them, and you '
    + 'engage whoever you choose. There is no minimum commitment and no package.',
    'Book a trial day before you book a fortnight. It costs little and it tells you '
    + 'everything about whether the handover works.',
  ],
});
