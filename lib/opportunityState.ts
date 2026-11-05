/**
 * What the opportunity buttons hand back. Its own module so the client component
 * imports no server code.
 *
 * Both answers get a message of the same length and temperature. A warm "wonderful,
 * thank you!" for yes and a terse "noted" for no is a performance record written in
 * tone, and providers read tone.
 */
export type RespondState =
  | { state: 'idle' }
  | { state: 'answered'; message: string }
  | { state: 'error'; message: string };

export const RESPOND_IDLE: RespondState = { state: 'idle' };

export const INTERESTED =
  'Thank you. We have told the household you are interested and we will call you to arrange it.';

export const NOT_THIS_ONE =
  'Thank you. We have taken this one off your list and we will keep you in mind for the next.';

export const ALREADY_ANSWERED =
  'You have already answered this one. If you have changed your mind, call us.';

export const RESPOND_FAILED =
  'We could not record that just now. Try again in a moment, or call us.';

export const NOT_FOUND = 'That is not on your list any more.';
