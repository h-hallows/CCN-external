'use client';

/**
 * The household enquiry form. Web build spec § 3.1 and § 3.2.
 *
 * WHY THIS DID NOT EXIST. `/api/inquiry` has been deployed since the front door went in:
 * validated against a strict schema, rate-limited, honeypotted, writing to `inquiries`
 * and notifying the operator. Nothing on the site called it. The whole application
 * contained exactly one `fetch(` and it went to `/api/refer` — so a family reading the
 * marketing pages had no way to reach us except a telephone number the site does not
 * have yet. A working pipeline with no door on the front of it.
 *
 * NO ACCOUNT, AND NOTHING REQUIRED THAT WE DO NOT NEED. A name, a number we can call,
 * and what they are after. Everything else is optional, because somebody arranging care
 * on the day of a discharge is not going to complete fourteen fields, and an enquiry
 * with four is worth more than a form nobody finishes.
 *
 * WHAT IS NOT ON IT. Nothing clinical — no diagnosis, no medication, no condition
 * field. We take enough to call back; the detail belongs in that conversation and not
 * in a public write path. And no price anywhere: the rate is the provider's and stays
 * negotiable with the household (I5).
 */
import { usePathname } from 'next/navigation';
import {
  Confirmation, errorsOf, Field, Group, Honeypot, inputStyle, postIntake, Submit, twoUp,
  useIntake,
} from '@/components/intakeForm';
import {
  AREA_OPTIONS, CARE_OPTIONS, PAYMENT_OPTIONS, RELATIONSHIP_OPTIONS, URGENCY_OPTIONS,
} from '@/lib/vocabulary';

export function EnquiryForm({ careType }: { careType?: string }) {
  const [result, setResult] = useIntake();
  /*
   * Which page they came from, recorded as the enquiry's source. It is the only thing
   * that can answer whether the crossed landing pages are worth keeping — `DEFERRED.md`
   * says that number decides what gets built next — and it is taken from the router
   * rather than from a hidden field a form could get wrong.
   */
  const path = usePathname();
  const errors = errorsOf(result);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult({ state: 'sending' });
    const form = new FormData(event.currentTarget);
    setResult(await postIntake('/api/inquiry', form, (body) => {
      body.sourcePath = path;
    }));
  }

  if (result.state === 'sent') {
    return (
      <Confirmation message={result.message} reference={result.reference}>
        <p>
          We will ask what the days actually look like, who is around, and what has
          already been tried. Then we put forward the two or three people who fit.
        </p>
        <p>
          Nothing is agreed by sending this, and we do not pass your details to anyone
          until you have told us to.
        </p>
      </Confirmation>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 'var(--measure)' }}>
      <Group
        legend="What you need"
        hint="If you are not sure yet, say so — most people are not, and it is what the
          call is for."
      >
        <div style={twoUp}>
          <Field id="careType" label="What kind of care" errors={errors.careType}>
            <select
              id="careType" name="careType" required
              defaultValue={careType ?? ''} style={inputStyle(errors.careType)}
            >
              <option value="" disabled>Choose one</option>
              {CARE_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field id="area" label="Where they are" errors={errors.area}>
            <select id="area" name="area" required defaultValue="" style={inputStyle(errors.area)}>
              <option value="" disabled>Choose one</option>
              {AREA_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </Field>
          <Field id="urgency" label="When it is needed" errors={errors.urgency}>
            <select id="urgency" name="urgency" required defaultValue="" style={inputStyle(errors.urgency)}>
              <option value="" disabled>Choose one</option>
              {URGENCY_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </Field>
          <Field
            id="patternNote" label="Roughly what hours (optional)"
            hint="“Weekday mornings”, “nights”, “three days a week” — a sketch is plenty."
            errors={errors.patternNote}
          >
            <input
              id="patternNote" name="patternNote" maxLength={400}
              style={inputStyle(errors.patternNote)} autoComplete="off"
            />
          </Field>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <Field
            id="startNote" label="Anything fixed about the start (optional)"
            hint="“Discharging Monday”, “after the operation on the 14th”."
            errors={errors.startNote}
          >
            <input
              id="startNote" name="startNote" maxLength={200}
              style={inputStyle(errors.startNote)} autoComplete="off"
            />
          </Field>
        </div>
      </Group>

      <Group legend="How to reach you">
        <div style={twoUp}>
          <Field id="name" label="Your name" errors={errors.name}>
            <input
              id="name" name="name" required maxLength={120} autoComplete="name"
              style={inputStyle(errors.name)}
            />
          </Field>
          <Field id="relationship" label="Who it is for" errors={errors.relationship}>
            <select
              id="relationship" name="relationship" required defaultValue=""
              style={inputStyle(errors.relationship)}
            >
              <option value="" disabled>Choose one</option>
              {RELATIONSHIP_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>
          <Field
            id="phone" label="Your phone" errors={errors.phone}
            hint="The quickest way to get this moving. We call; we do not text."
          >
            <input
              id="phone" name="phone" type="tel" required maxLength={32} autoComplete="tel"
              style={inputStyle(errors.phone)}
            />
          </Field>
          <Field id="email" label="Your email (optional)" errors={errors.email}>
            <input
              id="email" name="email" type="email" maxLength={200} autoComplete="email"
              style={inputStyle(errors.email)}
            />
          </Field>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <Field
            id="paymentMethod" label="How it is likely to be paid for"
            hint="Only so we know whether a policy is involved. It changes nothing about
              who we would put forward."
            errors={errors.paymentMethod}
          >
            <select
              id="paymentMethod" name="paymentMethod" required defaultValue=""
              style={inputStyle(errors.paymentMethod)}
            >
              <option value="" disabled>Choose one</option>
              {PAYMENT_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </Group>

      <Group
        legend="Anything else"
        hint="In your own words. Please leave out diagnoses and medication — we will go
          through all of that on the call, not on a web form."
      >
        <div style={{ marginTop: '1rem' }}>
          <Field id="message" label="What is going on (optional)" errors={errors.message}>
            <textarea
              id="message" name="message" rows={5} maxLength={2000}
              style={inputStyle(errors.message)}
            />
          </Field>
        </div>
      </Group>

      <Honeypot />
      <Submit label="Send this to us" sendingLabel="Sending…" result={result} />

      <p style={{ marginTop: '1.25rem', fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
        Sending this does not commit you to anything. We are a referral registry: we
        introduce you to a provider, and you engage them directly and agree the rate
        with them.
      </p>
    </form>
  );
}
