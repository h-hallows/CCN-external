import { assertComplete, type CrossedPage } from './types';

export const page: CrossedPage = assertComplete({
  service: 'overnight-newborn-care',
  area: 'pacific-palisades',
  title: 'Overnight Newborn Care in Pacific Palisades',
  summary:
    'Overnight newborn cover in Pacific Palisades. We introduce people who have done '
    + 'it before; you engage whoever you choose.',
  localContext: [
    'The Palisades is far enough from the hospitals that a night shift here is a '
    + 'committed drive at both ends, especially west of the village. People who take '
    + 'this work regularly tend to live on this side of town, and the short list we '
    + 'put forward reflects that rather than pretending distance does not matter.',
    'Houses here are large and often have a separate wing or guest room, which makes '
    + 'genuine overnight cover workable in a way it is not in a flat. It also means the '
    + 'person needs to know the layout before three in the morning, not during it.',
  ],
  commonCases: [
    'The first six to twelve weeks with a single baby, where the parents want to sleep '
    + 'through and have the baby brought to them to feed.',
    'Twins, where the arithmetic simply does not work with two parents and no help, and '
    + 'the overnight cover runs longer than it would otherwise.',
  ],
  questions: [
    {
      q: 'What does an overnight person actually do?',
      a: 'Feeding, settling, changing, and watching. Whether they feed the baby or '
        + 'bring the baby to you depends on how you are feeding and is entirely your '
        + 'call. They are there so the household sleeps, which is the whole point.',
    },
    {
      q: 'How many nights a week is normal?',
      a: 'Anything from two to seven, and it usually drops over time. Families often '
        + 'start at five or six and taper. We would rather you book fewer nights and '
        + 'add than commit to seven and feel you have to use them.',
    },
    {
      q: 'Is this a night nurse?',
      a: 'Usually not, and the word matters. Most overnight newborn work is done by '
        + 'experienced caregivers rather than by nurses. If there is a medical reason '
        + 'to want a nurse — a preterm baby on monitors, say — tell us, because that is '
        + 'a different referral with different requirements.',
    },
    {
      q: 'Can we meet someone before the baby arrives?',
      a: 'Yes, and it is much the best way. Meeting two or three people at thirty-four '
        + 'weeks, with nothing at stake, produces a better decision than meeting one '
        + 'person on day three with everyone exhausted.',
    },
  ],
  rateKey: 'overnight_newborn',
  reviewedOn: '2026-11-05',
  body: [
    'Overnight newborn care is the most straightforward thing we arrange and the one '
    + 'families are most reluctant to ask for. The arrangement is simple: somebody '
    + 'experienced is awake in your house while you are not.',
    'We check the same things we check for every referral — background screening, '
    + 'tuberculosis clearance, resuscitation certification where it applies — against '
    + 'the issuing body rather than against a photocopy. Then you meet people and '
    + 'decide.',
    'Book early if you can. The people who are good at this are booked months out, and '
    + 'the week you need them is not the week to start looking.',
  ],
});
