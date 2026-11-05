import { assertComplete, type CrossedPage } from './types';

export const page: CrossedPage = assertComplete({
  service: 'post-surgical-recovery',
  area: 'beverly-hills',
  title: 'Post-Surgical Recovery Care in Beverly Hills',
  summary:
    'Private recovery cover in Beverly Hills, arranged after a call. We refer; you '
    + 'engage and direct the provider yourself.',
  localContext: [
    'Cedars-Sinai sits at the eastern edge of the area, so a discharge here is often '
    + 'a fifteen-minute drive rather than an afternoon of logistics. That changes what '
    + 'is realistic: cover can start the same day far more often than it can further west.',
    'A great deal of Beverly Hills surgery is elective and scheduled weeks ahead, which '
    + 'means the useful conversation usually happens before the operation rather than '
    + 'in the car park afterwards. Families who call us in advance get a short list to '
    + 'meet rather than whoever is free on the day.',
  ],
  commonCases: [
    'Hip and knee replacement, two to six weeks of daytime cover while the household '
    + 'manages stairs, ice and the physiotherapy schedule.',
    'Plastic and reconstructive aftercare where the first seventy-two hours need '
    + 'someone awake overnight, and the weeks after need almost nobody.',
  ],
  questions: [
    {
      q: 'How soon after discharge should care start?',
      a: 'On the day of discharge, in most cases. The first night at home is the one '
        + 'families underestimate — pain relief timing shifts, the house is not set up '
        + 'yet, and nobody has slept. If the surgery is booked, call us a week ahead '
        + 'and you can meet people before you need them.',
    },
    {
      q: 'Does my long-term care policy cover this?',
      a: 'Often, for personal care, and less often for short post-surgical cover, '
        + 'because many policies require help with a set number of daily activities '
        + 'over a defined period. Tell us the carrier when you call and we will say '
        + 'what we have seen; the insurer decides, not us.',
    },
    {
      q: 'Who is actually responsible for the person who comes?',
      a: 'You are. We are a referral registry: we find and check people and introduce '
        + 'them, and you engage and direct whoever you choose. That is not a disclaimer, '
        + 'it is the arrangement, and we go through it with you on the phone before any '
        + 'introduction is made.',
    },
    {
      q: 'Can the same person cover both days and nights?',
      a: 'Not safely, and we will not arrange it. Round-the-clock recovery cover needs '
        + 'at least two people, and we would rather tell you that before you build a '
        + 'plan around one person who will be exhausted by Wednesday.',
    },
  ],
  rateKey: 'post_surgical',
  reviewedOn: '2026-11-05',
  body: [
    'Recovery at home is mostly logistics, and the logistics are worst in the first '
    + 'week. Someone has to track the pain relief, get the person to the bathroom '
    + 'without a fall, keep the dressings dry, notice when something looks wrong, and '
    + 'do all of it while the family sleeps. That is the work.',
    'We keep a short list of people who have done this specific kind of recovery before '
    + 'and check each one against the body that issued their credentials. Then we talk '
    + 'to you on the phone, go through what the law requires us to tell you, and '
    + 'introduce two or three people you can meet. You choose, you engage them '
    + 'directly, and you agree the rate with them.',
    'Surgeons in this area discharge on a schedule. If you know your date, the easiest '
    + 'version of this is a call now and a decision later.',
  ],
});
