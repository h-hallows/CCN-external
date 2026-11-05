import { assertComplete, type CrossedPage } from './types';

export const page: CrossedPage = assertComplete({
  service: 'companion-care',
  area: 'westwood',
  title: 'Companion Care in Westwood',
  summary:
    'Company, driving and a pair of eyes in Westwood, from people introduced to you '
    + 'rather than assigned.',
  localContext: [
    'Westwood has the unusual combination of a major medical campus and a large '
    + 'population of older people living independently nearby, often within a few '
    + 'streets of their own doctors. That makes appointment accompaniment a far larger '
    + 'part of companion work here than it is elsewhere on the Westside.',
    'Parking around the village and the campus is genuinely difficult, and an '
    + 'appointment that takes forty minutes can take two hours door to door. Companions '
    + 'who work this area regularly build that into the day instead of being surprised '
    + 'by it each time.',
  ],
  commonCases: [
    'Weekly appointment runs with someone who has stopped driving, where the real '
    + 'service is that the household stops rearranging work around clinic times.',
    'Several afternoons a week with someone living alone whose family is out of state, '
    + 'largely for company and to notice early if something is changing.',
  ],
  questions: [
    {
      q: 'Is a companion allowed to drive?',
      a: 'Many are, and we record who does and check their insurance and driving '
        + 'licence as part of the same process. If driving matters, say so when you '
        + 'call so we only put forward people who do it.',
    },
    {
      q: 'What will a companion not do?',
      a: 'Anything personal or clinical. Bathing, toileting and transfers are personal '
        + 'care, and wound care or injections need a nurse. Each person also tells us '
        + 'in their own words what they will not take on, and we show you exactly what '
        + 'they wrote.',
    },
    {
      q: 'How do we start without it feeling like an intrusion?',
      a: 'Short visits with a defined purpose work far better than open-ended company. '
        + 'Two afternoons a week with a reason to leave the house is easier for '
        + 'everybody to accept than someone sitting in the living room.',
    },
    {
      q: 'Can hours change as things change?',
      a: 'Yes. Most arrangements that start as companionship grow into personal care '
        + 'over a year or two. When that happens we will tell you plainly, because the '
        + 'person who is right for company may not be right for the next stage.',
    },
  ],
  rateKey: 'companion',
  reviewedOn: '2026-11-05',
  body: [
    'Companion care is the least clinical thing we arrange and often the most useful. '
    + 'Someone turns up, takes an interest, drives to the appointment, and notices that '
    + 'the post has been piling up for a fortnight.',
    'We check everyone we refer the same way regardless of how clinical the work is: '
    + 'background screening and tuberculosis clearance at a minimum, verified against '
    + 'the issuing body. The standard does not drop because the work is gentler.',
    'Rates for this work are the lowest of anything we refer, and the person sets them '
    + 'themselves. The current ranges are below, straight from the table we maintain.',
  ],
});
