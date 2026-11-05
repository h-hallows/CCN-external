import { assertComplete, type CrossedPage } from './types';

export const page: CrossedPage = assertComplete({
  service: 'personal-care',
  area: 'santa-monica',
  title: 'Personal Care at Home in Santa Monica',
  summary:
    'Help with bathing, dressing and mobility in Santa Monica, from people you meet '
    + 'before you engage them.',
  localContext: [
    'A lot of Santa Monica living is in flats and condominium buildings north of '
    + 'Wilshire, where a lift, a parking permit and a guest-space policy shape the '
    + 'working day more than the distance does. These are small things that become '
    + 'large if nobody asks about them in advance.',
    'The area has an unusually walkable centre, which matters for this service in a way '
    + 'it does not for most. Where someone can still get out to the farmers market or '
    + 'along the promenade with an arm to hold, the care plan is about keeping that '
    + 'going rather than replacing it.',
  ],
  commonCases: [
    'Someone recovering confidence after a fall, where the work is mostly mobility, '
    + 'bathing and being present at the times of day when a fall is most likely.',
    'Progressive conditions where the household wants the same two people over a long '
    + 'period rather than a rota of strangers, and continuity matters more than cost.',
  ],
  questions: [
    {
      q: 'What counts as personal care?',
      a: 'Bathing, dressing, toileting, transfers, help with eating, and the mobility '
        + 'work that keeps someone moving safely. It does not include anything '
        + 'clinical — wound care, injections and assessment need a nurse, which is a '
        + 'different referral.',
    },
    {
      q: 'Can we have the same person every time?',
      a: 'That is what we aim for, and it is why we ask about the pattern before the '
        + 'people. A regular with one or two named alternates who have met you works; '
        + 'a different face every week does not, and we will not pretend otherwise.',
    },
    {
      q: 'Who decides how the care is done?',
      a: 'You do, with the person you engage. We do not write care plans, direct the '
        + 'work or supervise anybody — a registry that did would be something else '
        + 'entirely, with different obligations. What we do is find and check people '
        + 'and introduce them.',
    },
    {
      q: 'What if it is not working out?',
      a: 'Tell us and we will put other people forward. You are not locked in, there is '
        + 'no penalty, and it does not go on anybody’s record. It happens, and it is '
        + 'usually about fit rather than fault.',
    },
  ],
  rateKey: 'personal_care',
  reviewedOn: '2026-11-05',
  body: [
    'Personal care is intimate work and the match matters more than the credential. '
    + 'Two people with identical certifications can be entirely different in a bathroom '
    + 'at seven in the morning, which is why we introduce rather than assign.',
    'Everyone we put forward has been screened and has current clearances, checked '
    + 'against the body that issued them. That is the floor, not the point. The point is '
    + 'that you meet two or three people and pick the one you would want in the house.',
    'We will go through the arrangement with you on the phone first, including the parts '
    + 'the law requires us to say out loud. It takes a few minutes and it is the step '
    + 'that makes everything afterwards legitimate.',
  ],
});
