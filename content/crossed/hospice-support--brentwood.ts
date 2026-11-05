import { assertComplete, type CrossedPage } from './types';

export const page: CrossedPage = assertComplete({
  service: 'hospice-support',
  area: 'brentwood',
  title: 'Hospice Support at Home in Brentwood',
  summary:
    'Private cover alongside a hospice team in Brentwood, arranged quickly and '
    + 'without a sales conversation.',
  localContext: [
    'Brentwood sits close to several of the hospice services that cover the Westside, '
    + 'so the visiting nurse is rarely far away. What families here usually need is not '
    + 'more clinical visits but the hours between them, which is exactly the gap '
    + 'private cover fills.',
    'The housing stock is largely single-family with stairs, and a hospital bed often '
    + 'ends up in a downstairs room that was never meant to be a bedroom. Getting that '
    + 'right in the first day or two makes everything afterwards easier, and the people '
    + 'we refer have usually done it before.',
  ],
  commonCases: [
    'Night cover so the spouse or adult child can sleep, which is almost always the '
    + 'first thing to break down and the last thing anyone asks for.',
    'Continuous cover in the last days, arranged at very short notice and often '
    + 'overnight, with two or three people rotating rather than one person stretched '
    + 'past what is safe.',
  ],
  questions: [
    {
      q: 'Does this replace the hospice team?',
      a: 'No, and it should not. Hospice provides the clinical care, the equipment and '
        + 'the medication guidance. What we refer is the person who is there the rest '
        + 'of the time — turning, washing, sitting, and calling the hospice when '
        + 'something changes.',
    },
    {
      q: 'How quickly can cover start?',
      a: 'Same day is often possible, and we will tell you honestly if it is not rather '
        + 'than take the enquiry and hope. If we cannot cover tonight we would rather '
        + 'say so now so you can ask somebody else at the same time.',
    },
    {
      q: 'Can we start with nights and add days later?',
      a: 'Yes, and that is the usual shape. Most families start with the nights, '
        + 'because that is where exhaustion does its damage, and add daytime hours as '
        + 'things change. Nothing is a fixed package.',
    },
    {
      q: 'What happens to the arrangement afterwards?',
      a: 'It ends when you say it ends. There is no notice period, no minimum, and no '
        + 'call from us afterwards asking how it went or offering anything else. We '
        + 'will send what you need for the estate and leave you alone.',
    },
  ],
  rateKey: 'hospice_support',
  reviewedOn: '2026-11-05',
  body: [
    'This is the work people find hardest to ask for and are most relieved to have. '
    + 'The hospice team is excellent and they are not there at four in the morning. '
    + 'Someone has to be.',
    'We will not sell you a package, a programme or a tier. You tell us the hours you '
    + 'cannot cover, we put forward people who have done this kind of work before, and '
    + 'you choose. If the right answer is that you need fewer hours than you asked for, '
    + 'we will say that too.',
    'If you are calling in the middle of something, say so at the start and we will '
    + 'skip the rest of it.',
  ],
});
