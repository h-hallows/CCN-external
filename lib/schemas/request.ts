/**
 * The one write a signed-in household may make to the bench. Web build spec § 4.1, W6.
 *
 * `.strict()` for the same reason the intake schemas are: an unknown key is a rejection,
 * not a silently dropped field. This one matters more than most, because the keys a
 * caller must never be able to set — `status`, `referralId` — are exactly the keys that
 * would turn a request into something it is not. They are absent here, absent from the
 * INSERT, and refused by the row-level security policy. Three places, deliberately.
 */
import { z } from 'zod';

export const RequestProviderSchema = z.object({
  providerId: z.string().uuid(),
  /** Passed to the operator as written. The household's words, not a form field we parse. */
  note: z.string().trim().max(1000).optional(),
}).strict();

export type RequestProviderInput = z.infer<typeof RequestProviderSchema>;
