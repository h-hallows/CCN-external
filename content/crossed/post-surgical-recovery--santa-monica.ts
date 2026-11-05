import { assertComplete, type CrossedPage } from './types';

export const page: CrossedPage = assertComplete({
  service: 'post-surgical-recovery',
  area: 'santa-monica',
  title: 'Post-Surgical Recovery Care in Santa Monica',
  summary:
    'Recovery cover at home in Santa Monica after a hospital discharge, arranged by '
    + 'phone and introduced before you commit.',
  localContext: [
    'Providence Saint John’s and the UCLA campus on Sixteenth Street both discharge '
    + 'into this area, and both tend to do it in the late morning. A discharge time '
    + 'that lands before noon is the difference between cover starting today and cover '
    + 'starting tomorrow, so it is the first thing we ask.',
    'A good deal of Santa Monica housing is flats with lifts and controlled entry, '
    + 'which makes the first day home easier than a hillside house with stairs — but '
    + 'only if someone has sorted out building access before the ambulance transport '
    + 'arrives rather than after.',
  ],
  commonCases: [
    'Orthopaedic recovery where the household needs daytime help for a few weeks and '
    + 'is managing the nights themselves.',
    'Abdominal surgery in someone living alone, where the risk is not the wound but '
    + 'the lack of anyone to notice that something has changed.',
  ],
  questions: [
    {
      q: 'Can cover start the day I am discharged?',
      a: 'Often, if you call before the discharge rather than after it. Give us the '
        + 'surgery date and we can have people lined up to meet; give us two hours’ '
        + 'notice on the day and we will try, but we will tell you honestly what is '
        + 'possible.',
    },
    {
      q: 'Do I need a nurse or a caregiver?',
      a: 'Most recovery is caregiver work — mobility, bathing, meals, watching. You '
        + 'need a nurse if there is wound care, injections or a line to manage. Tell us '
        + 'what the discharge paperwork says and we will tell you which it is, '
        + 'including when the answer is the cheaper one.',
    },
    {
      q: 'How long do people usually need this?',
      a: 'Two to six weeks for most orthopaedic recovery, less for soft tissue, longer '
        + 'if there is a complication. Everyone wants a number before they start and '
        + 'nobody can give an honest one, so we would rather set it up weekly and let '
        + 'you stop when you are ready.',
    },
    {
      q: 'What if I need to extend at the last minute?',
      a: 'Call us. Continuity is worth protecting, so we try hard to keep the same '
        + 'person rather than substituting somebody new into the last week of a '
        + 'recovery. If they genuinely cannot, we will say so early rather than on the '
        + 'day.',
    },
  ],
  rateKey: 'post_surgical',
  reviewedOn: '2026-11-05',
  body: [
    'Most post-surgical trouble is not clinical. It is a person who cannot get out of '
    + 'bed safely, a medication schedule nobody is tracking, and a family member who '
    + 'has not slept and is making decisions badly as a result.',
    'We introduce people who have done recovery work before and whose clearances we '
    + 'have checked against the issuing body. You meet them, you choose, and you engage '
    + 'whoever you pick directly. We do not employ them and we do not take a cut of '
    + 'their hours.',
    'If your surgery is booked, the call to make is this week rather than the week '
    + 'after.',
  ],
});
