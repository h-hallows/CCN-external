/**
 * Shared responses for the three public intake routes.
 *
 * Every response is deliberately uninformative about anything already in the database.
 * A public form that says "we already have a case for this household" is a disclosure,
 * and anyone can reach these.
 */
import type { ZodError } from 'zod';

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    return (await request.json()) as Record<string, unknown>;
  }
  const form = await request.formData();
  const out: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value !== 'string') continue;
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else out[key] = [existing, value];
  }
  return out;
}

/** A short, quotable reference. Enough for the operator to find it, not an id to guess. */
export function accepted(message: string, id: string): Response {
  return Response.json(
    { ok: true, message, reference: id.slice(0, 8) },
    { status: 202 },
  );
}

/**
 * A filled honeypot gets the same 200 a real submission does. Telling a bot it was
 * detected teaches whoever wrote it to stop filling the field.
 */
export function silentlyDropped(): Response {
  return Response.json({ ok: true }, { status: 202 });
}

/**
 * A refusal the caller can act on.
 *
 * `flatten()` splits a ZodError in two and this returned one half of it. Anything the
 * schema refuses at the OBJECT level rather than against a named field lands in
 * `formErrors`: an unrecognized key, which `.strict()` makes a rejection, or any future
 * `.refine()` written without a `path`. Those were dropped on the floor, so the response
 * was `{ ok: false, fieldErrors: {} }` — a 400 carrying no message and no field to hang
 * one on. The client then had nothing to render but its own fallback, and `{}` is truthy,
 * so it chose the wrong one and told the visitor to read notes that were not there.
 *
 * The object-level TEXT is deliberately not forwarded. "Unrecognized key(s) in object:
 * 'patternNode'" is true, is this end's fault rather than the visitor's, and names an
 * internal field to anybody who can reach a public form. So the caller gets one sentence
 * they can act on, and the detail goes where a developer will see it.
 */
export function rejected(error: ZodError): Response {
  const { fieldErrors, formErrors } = error.flatten();
  const body: { ok: false; fieldErrors: typeof fieldErrors; message?: string } = {
    ok: false, fieldErrors,
  };

  if (formErrors.length > 0) {
    /*
     * Key names only — a ZodError's OBJECT-level text never quotes a submitted value,
     * which is why this one is safe to log and the sentence below carries none of it.
     *
     * That is true of `formErrors` and not of `fieldErrors`, which does go to the
     * caller: zod's enum message is `Invalid enum value. Expected 'a' | 'b', received
     * 'what-they-typed'`, so a refused `careType`, `area`, `urgency`, `relationship`,
     * `partnerRole` or `type` comes back carrying the submitted string. Left as it is on
     * purpose — it is the caller's own input returned to the caller, React escapes it at
     * the render, and the valid values it also names are the options the form's own
     * select already shows. Said here so that nobody reads this line as a promise about
     * the whole response and builds on it.
     */
    console.warn('[intake] refused against the whole form:', formErrors.join('; '));
    body.message = 'We could not accept that form, and it is our end at fault rather '
      + 'than anything you typed. Please call us and we will take the details directly.';
  }

  return Response.json(body, { status: 400 });
}

export function limited(): Response {
  return Response.json(
    {
      ok: false,
      message: 'Too many submissions from here just now. Please call us instead.',
    },
    { status: 429 },
  );
}

export function failed(): Response {
  return Response.json(
    { ok: false, message: 'We could not record that just now. Please call us.' },
    { status: 503 },
  );
}
