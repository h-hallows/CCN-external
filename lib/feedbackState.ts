/**
 * The feedback form's copy and result shape. Its own module so the wording sits in one
 * place and a test can assert over it.
 *
 * THE WORDING IS THE CONTROL. I7 and § 687.2(e) permit feedback that informs future
 * referral decisions and forbid anything that feeds provider discipline, coaching,
 * training or corrective action. A form that asks a household to rate a named nurse is
 * the input to that forbidden workflow no matter what the database column is called,
 * so these questions ask about the introduction and about us.
 */
export type FeedbackState =
  | { state: 'idle' }
  | { state: 'thanks'; message: string }
  | { state: 'refused'; message: string }
  | { state: 'error'; message: string };

export const IDLE: FeedbackState = { state: 'idle' };

/** Both questions are about the referral service. Neither is about the provider. */
export const RATING_QUESTION = 'How well did the introduction suit what you needed?';
export const RATING_LOW = 'Not what we needed';
export const RATING_HIGH = 'Exactly right';
export const AGAIN_QUESTION = 'Would you come back to us next time?';
export const NOTES_QUESTION =
  'Anything you would tell us about how we handled it? (optional)';

export const USE_NOTE =
  'We use this to make better introductions, and for nothing else. It is not shared '
  + 'with the provider, it plays no part in how anyone is managed, assessed or paid, '
  + 'and there is no record of it on their file.';

export const THANKS =
  'Thank you. That goes to the person who arranged this, and it will shape what we '
  + 'put forward for you next time.';

export const ALREADY =
  'You have already answered for this introduction, and we have it.';

export const NOT_FOUND =
  'We could not find that introduction on your account.';

export const FAILED =
  'We could not record that just now, which is our problem and not yours. Please try '
  + 'again in a moment.';
