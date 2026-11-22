/**
 * What the three public forms SHOW a visitor when a submission is refused.
 *
 * `components/intakeForm.tsx` is the submit, the state machine and the error surfacing
 * for all three doors — the enquiry, the partner referral and the provider application —
 * so whatever it decides to say, it says on every public form at once. It exists because
 * the one form that predated it discarded the server's field errors entirely and showed
 * a single generic sentence instead; and then it reintroduced the same dead end one
 * layer up.
 *
 * THE BUG THESE ASSERT AGAINST. The fallback read `payload.fieldErrors ? A : B`, and an
 * empty object is truthy. So a submission refused against the whole form rather than
 * against any field — which `.strict()` makes an everyday outcome, and which the server
 * answered with `fieldErrors: {}` — chose the sentence that says "see the notes below",
 * and there were no notes below. A visitor read a refusal pointing at an empty space,
 * with nothing to correct and no reason given.
 *
 * The rule is therefore not "handle the empty object". It is that the form may send
 * somebody to the notes only when a note exists, whatever shape the server answers in.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { postIntake, errorsOf, IDLE, type IntakeState } from '@/components/intakeForm';

/** A server that answers with exactly this, once. */
function answering(status: number, body: unknown): void {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  })));
}

function submission(): FormData {
  const form = new FormData();
  form.append('name', 'Test Harness');
  form.append('phone', '(310) 555-0100');
  return form;
}

const send = (): Promise<IntakeState> => postIntake('/api/inquiry', submission());

function notes(result: IntakeState): string[] {
  return Object.values(errorsOf(result)).flatMap((m) => m ?? []);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a refusal the visitor can do something about', () => {
  it('points at the notes when the server named the fields', async () => {
    answering(400, {
      ok: false,
      fieldErrors: {
        phone: ['That does not look like a telephone number.'],
        area: ['Choose where they are.'],
      },
    });

    const result = await send();
    expect(result.state).toBe('error');
    expect(result).toMatchObject({ message: expect.stringContaining('notes below') });
    expect(notes(result)).toHaveLength(2);
    // Each one still reaches the field it belongs to, which is the whole point of the
    // module: a rejected referral used to leave a planner guessing which of fourteen.
    expect(errorsOf(result).phone)
      .toContain('That does not look like a telephone number.');
  });

  /*
   * THE RULE, over every shape a refusal can arrive in. Each of these was a 400 the
   * forms could receive, and the second one is what `.strict()` produces every time.
   */
  it('never sends a visitor to notes that are not there', async () => {
    const shapes: { what: string; status: number; body: unknown }[] = [
      { what: 'an empty fieldErrors object', status: 400, body: { ok: false, fieldErrors: {} } },
      { what: 'no fieldErrors key at all', status: 400, body: { ok: false } },
      {
        what: 'a field key carrying an empty list',
        status: 400,
        body: { ok: false, fieldErrors: { phone: [] } },
      },
      {
        what: 'a field key explicitly undefined',
        status: 400,
        body: { ok: false, fieldErrors: { phone: null } },
      },
      { what: 'a 503 with no body detail', status: 503, body: { ok: false } },
    ];

    for (const { what, status, body } of shapes) {
      answering(status, body);
      const result = await send();

      expect(result.state, what).toBe('error');
      const shown = result.state === 'error' ? result.message : '';
      expect(shown, `${what} produced a refusal with no wording at all`).toBeTruthy();

      if (/notes below/.test(shown)) {
        expect(
          notes(result).length,
          `with ${what}, the form said "see the notes below" and there were none`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('prefers what the server said over anything of its own', async () => {
    /*
     * The server is the only party that knows WHY. When it has written a sentence — a
     * rate limit, an outage, a form refused as a whole — that sentence is the one the
     * visitor gets, verbatim.
     */
    answering(429, {
      ok: false,
      message: 'Too many submissions from here just now. Please call us instead.',
    });

    const result = await send();
    expect(result).toMatchObject({
      state: 'error',
      message: 'Too many submissions from here just now. Please call us instead.',
    });
    expect(notes(result)).toEqual([]);
  });

  it('tells a visitor the submission did not land when the network does not answer', async () => {
    /*
     * A public form that fails silently is a family that believes it has asked for help.
     * The one outcome that must never look like success.
     */
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));

    const result = await send();
    expect(result.state).toBe('error');
    const shown = result.state === 'error' ? result.message : '';
    expect(shown).toBeTruthy();
    expect(shown).not.toMatch(/notes below/);
    expect(shown.toLowerCase()).toContain('call us');
  });

  it('reports a 200 that says ok:false as the refusal it is', async () => {
    // A route that answers 200 with `ok: false` is still a refusal. Reading only the
    // status would show this visitor a confirmation for something never recorded.
    answering(200, { ok: false, fieldErrors: { phone: ['Required'] } });

    const result = await send();
    expect(result.state).toBe('error');
  });

  it('carries the reference through on success, because it is what the caller quotes', async () => {
    answering(202, { ok: true, message: "Received. We'll call you today.", reference: 'dcd6b607' });

    const result = await send();
    expect(result).toEqual({
      state: 'sent', message: "Received. We'll call you today.", reference: 'dcd6b607',
    });
    expect(errorsOf(result)).toEqual({});
  });

  it('starts with nothing shown', () => {
    expect(IDLE).toEqual({ state: 'idle' });
    expect(errorsOf(IDLE)).toEqual({});
  });
});
