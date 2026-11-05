/**
 * What the request action hands back to the form. Its own module because a `'use server'`
 * file may export nothing but async functions, and a `'use client'` one is the wrong
 * place for something the server needs.
 *
 * The copy lives here, in one place, for a reason that is not tidiness: a test asserts
 * that no string on this path implies a placement was made. Keeping the wording in one
 * module makes that assertion mean something. See tests/request.test.ts.
 */
export type RequestState =
  | { state: 'idle' }
  | { state: 'asked'; message: string }
  | { state: 'already'; message: string }
  | { state: 'refused'; message: string }
  | { state: 'error'; message: string };

export const IDLE: RequestState = { state: 'idle' };

/**
 * Says what happened and what happens next, and stops there.
 *
 * "We have your request" is the whole truth. Anything warmer — that they are lined up,
 * that it is in hand, that a date is held — would describe a referral, and no referral
 * exists until an operator has made the § 1812.5095(f) disclosure on the phone.
 */
export const ASKED =
  'We have your request. We will call you to talk it through, and we will go through '
  + 'a few things with you before putting anyone forward.';

export const ALREADY =
  'You have already asked us about them, and it is on our list. We will call you.';

export const UNAVAILABLE =
  'We are checking something on their file first. Ask us to call and we will tell you '
  + 'where that stands, and put other people forward if that would help.';

export const NOT_FOUND =
  'We could not find them on your short list. The current list is on your short list page.';

export const FAILED =
  'We could not record that just now, which is our problem and not yours. Please call '
  + 'us and we will take it down by hand.';
