'use client';

/**
 * The partner referral form. Web build spec § 3.1 and § 4.3, W11.
 *
 * NO ACCOUNT. A discharge planner with a family to place at four on a Friday is not
 * going to register first, and the milestone's gate is that they do not have to. This
 * posts to /api/refer, which already carries the rate limit and the honeypot.
 *
 * WHAT IS NOT ON THIS FORM. The patient's name — initials only at this stage, because
 * a planner passing a full name to a third party before the family has engaged anybody
 * is a privacy problem for the planner. And nothing about payment, because there isn't
 * any: § 1812.531 forbids a nurses' registry dividing fees with a physician, hospital
 * or their agents, which is most of the people filling this in.
 *
 * ITS FOUR OPTION LISTS AND ITS SUBMIT LOGIC ARE NO LONGER HERE. The lists were a second
 * copy and had already drifted from core's — "a second copy of CARE_LABEL is how
 * 'Post-surgical' becomes 'Post surgical' on one page", as core's own header puts it —
 * and they now come from `lib/vocabulary.ts`, where `tests/vocabulary.test.ts` keeps the
 * set in step with what the database can store. The submit was the only one of its kind
 * when it was written and is now one of three, so it lives in `components/intakeForm`
 * — which is also where it picked up the server's field-level errors. This form had
 * been discarding them: a rejected referral showed one generic sentence and left a
 * planner guessing which of fourteen fields had been refused.
 */
import {
  Confirmation, errorsOf, Field, Group, groupErrorId, Honeypot, inputStyle, postIntake,
  Submit, twoUp, useIntake,
} from '@/components/intakeForm';
import {
  AREA_OPTIONS, CARE_OPTIONS, PARTNER_ROLE_OPTIONS, PARTNER_URGENCY_OPTIONS,
} from '@/lib/vocabulary';

/**
 * Written once because it is both the legend and the root of the error's id. Two copies
 * of this string is a describedby that stops resolving the day somebody edits the
 * heading, and nothing would fail — the attribute would simply point at nothing.
 */
const CONSENT_GROUP = 'Who we should call';

export interface KnownPartner {
  name: string;
  org: string | null;
  phone: string | null;
  email: string | null;
}

export function PartnerReferralForm({
  acknowledgedBy, directLine, you,
}: {
  acknowledgedBy: string | null;
  directLine: string | null;
  /**
   * Filled in from the registry's own record when a partner is signed in — not from
   * the browser, and not from what they typed last time. The acknowledgement goes to
   * the operator's copy, so a form that disagrees with it is a planner who never
   * hears back. Still editable: a locked field is worse than a wrong one.
   */
  you?: KnownPartner | null;
}) {
  const [result, setResult] = useIntake();
  const errors = errorsOf(result);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult({ state: 'sending' });
    const form = new FormData(event.currentTarget);
    setResult(await postIntake('/api/refer', form, (body, f) => {
      // The schema wants `z.literal(true)`, and a checkbox posts the string "on".
      body.consentNote = f.get('consentNote') === 'on';
    }));
  }

  if (result.state === 'sent') {
    return (
      <Confirmation message={result.message} reference={result.reference}>
        {/*
          * § 4.3: the acknowledgement "names a real person and gives a direct line".
          * That is the whole trust mechanism here — somebody who has just sent a
          * family to a stranger wants to know who picked it up.
          */}
        <p>
          {acknowledgedBy
            ? <>It has gone to {acknowledgedBy}, who will call the family and then come back to you.</>
            : <>It has gone straight to the person who will call the family and then come back to you.</>}
          {directLine ? <> If you need us before that, the direct line is {directLine}.</> : null}
        </p>
      </Confirmation>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 'var(--measure)' }}>
      <Group
        legend="Who you are"
        hint={you
          ? 'Filled in from what we have for you, and you can change any of it. Because '
            + 'you are signed in, this referral will show up on your own page with where '
            + 'it has got to.'
          : undefined}
      >
        <div style={twoUp}>
          <Field id="partnerName" label="Your name" errors={errors.partnerName}>
            <input id="partnerName" name="partnerName" required maxLength={120}
              defaultValue={you?.name ?? ''} style={inputStyle(errors.partnerName)} />
          </Field>
          <Field id="partnerOrg" label="Where you work" errors={errors.partnerOrg}>
            <input id="partnerOrg" name="partnerOrg" maxLength={160}
              defaultValue={you?.org ?? ''} style={inputStyle(errors.partnerOrg)} />
          </Field>
          <Field id="partnerRole" label="Your role" errors={errors.partnerRole}>
            <select id="partnerRole" name="partnerRole" required defaultValue=""
              style={inputStyle(errors.partnerRole)}>
              <option value="" disabled>Choose one</option>
              {PARTNER_ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>
          <Field id="partnerPhone" label="Your phone" errors={errors.partnerPhone}>
            <input id="partnerPhone" name="partnerPhone" type="tel" required maxLength={32}
              defaultValue={you?.phone ?? ''} style={inputStyle(errors.partnerPhone)} />
          </Field>
          <Field id="partnerEmail" label="Your email" errors={errors.partnerEmail}>
            <input id="partnerEmail" name="partnerEmail" type="email" required maxLength={200}
              defaultValue={you?.email ?? ''} style={inputStyle(errors.partnerEmail)} />
          </Field>
        </div>
      </Group>

      <Group
        legend="Who the patient is"
        hint="Initials only at this stage. We do not need a name until the family has
          spoken to us themselves."
      >
        <div style={twoUp}>
          <Field id="patientInitials" label="Patient initials" errors={errors.patientInitials}>
            <input id="patientInitials" name="patientInitials" required maxLength={8}
              style={inputStyle(errors.patientInitials)} />
          </Field>
          <Field id="careType" label="What they need" errors={errors.careType}>
            <select id="careType" name="careType" required defaultValue=""
              style={inputStyle(errors.careType)}>
              <option value="" disabled>Choose one</option>
              {CARE_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field id="area" label="Where" errors={errors.area}>
            <select id="area" name="area" required defaultValue="" style={inputStyle(errors.area)}>
              <option value="" disabled>Choose one</option>
              {AREA_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </Field>
          <Field id="urgency" label="When" errors={errors.urgency}>
            <select id="urgency" name="urgency" required defaultValue=""
              style={inputStyle(errors.urgency)}>
              <option value="" disabled>Choose one</option>
              {PARTNER_URGENCY_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </Group>

      {/*
        * The consent tick is refused on its own, not with the group, so its error goes
        * through `Group`'s group-level slot and is ALSO pointed at from the checkbox
        * itself below — it was neither. A planner whose referral came back because the
        * box was unticked read a red line beside a box that announced nothing.
        */}
      <Group legend={CONSENT_GROUP} errors={errors.consentNote}>
        <div style={twoUp}>
          <Field id="contactName" label="Their name" errors={errors.contactName}>
            <input id="contactName" name="contactName" required maxLength={120}
              style={inputStyle(errors.contactName)} />
          </Field>
          <Field id="contactPhone" label="Their phone" errors={errors.contactPhone}>
            <input id="contactPhone" name="contactPhone" type="tel" required maxLength={32}
              style={inputStyle(errors.contactPhone)} />
          </Field>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <Field id="note" label="Anything we should know (optional)" errors={errors.note}>
            <textarea id="note" name="note" rows={4} maxLength={1200}
              style={inputStyle(errors.note)} />
          </Field>
        </div>

        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: '.5rem',
          marginTop: '1.1rem', fontSize: 'var(--step--1)',
        }}>
          <input
            type="checkbox" name="consentNote" required style={{ marginTop: '.2rem' }}
            aria-describedby={errors.consentNote ? groupErrorId(CONSENT_GROUP) : undefined}
            {...(errors.consentNote ? { 'aria-invalid': true } : {})}
          />
          <span>
            The family have agreed I can pass their contact details to you.
          </span>
        </label>
      </Group>

      <Honeypot />
      <Submit label="Send this to us" sendingLabel="Sending…" result={result} />
    </form>
  );
}
