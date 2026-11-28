'use client';

/**
 * The provider application form. Web build spec § 3.1.
 *
 * WHY THIS DID NOT EXIST. `/api/apply` has been deployed as long as the enquiry route,
 * with the same validation, the same rate limit and the same honeypot, and with the
 * refinement that § 1812.528 implies — a licence number is required of an RN or an LVN,
 * because the registry has to inspect the licence itself. Nothing on the site called it.
 * `/for-providers` explains at length how referrals work here and offered no way to
 * apply.
 *
 * THERE IS NO SIGNUP. This writes to `provider_applications` and nowhere else. No public
 * path creates a `providers` row; an operator reads the application, verifies the
 * credentials against the body that issued them, and onboards. That is the whole
 * compliance posture, so this form promises a reading and not a decision.
 *
 * WHAT IS DELIBERATELY ABSENT. No rate field — I5: the provider sets their own rate and
 * it stays negotiable with the household, and a rate asked for at application reads as a
 * rate we are agreeing. No availability grid, because we record what somebody tells us
 * and do not build them a roster. No certifications or coursework (I1), no reliability
 * score, nothing about how often they say no (I7). What is asked for is what somebody
 * has actually done.
 */
import { useState } from 'react';
import {
  Confirmation, errorsOf, Field, Group, Honeypot, inputStyle, postIntake, Submit, twoUp,
  useIntake,
} from '@/components/intakeForm';
import {
  AREA_OPTIONS, LANGUAGE_OPTIONS, PROVIDER_TYPE_OPTIONS, SPECIALTY_OPTIONS,
} from '@/lib/vocabulary';

const LICENSED = ['RN', 'LVN'];

const checkRow: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: '.5rem .9rem', marginTop: '.45rem',
};

function Check({ name, value, label }: { name: string; value: string; label: string }) {
  return (
    <label style={{
      display: 'inline-flex', alignItems: 'center', gap: '.4rem',
      fontSize: 'var(--step--1)', border: '1px solid var(--line)',
      background: 'var(--surface)', borderRadius: 6, padding: '.3rem .6rem',
    }}>
      <input type="checkbox" name={name} value={value} />
      <span>{label}</span>
    </label>
  );
}

export function ProviderApplicationForm() {
  const [result, setResult] = useIntake();
  const [type, setType] = useState('');
  const errors = errorsOf(result);
  const needsLicence = LICENSED.includes(type);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult({ state: 'sending' });
    const form = new FormData(event.currentTarget);
    setResult(await postIntake('/api/apply', form, (body, f) => {
      /*
       * Repeated checkboxes are arrays, and the schema is `.strict()` with
       * `z.array(z.string())` — so these cannot ride in as the last value wins, which
       * is what the generic string sweep in `postIntake` would do.
       */
      body.areas = f.getAll('areas');
      body.languages = f.getAll('languages');
      body.specialties = f.getAll('specialties');
    }));
  }

  if (result.state === 'sent') {
    return (
      <Confirmation message={result.message} reference={result.reference}>
        <p>
          A person reads every one of these. If it looks like a fit we will call you, and
          then we verify your credentials against the body that issued them before
          anything else happens.
        </p>
        <p>
          You are never charged a fee of any kind — not to apply, not to join, and
          nothing deducted from what you earn.
        </p>
      </Confirmation>
    );
  }

  return (
    /*
     * A real `method` and `action`, although the press is handled in JavaScript: a
     * form with neither GETs to the current URL with every named field in the query
     * string, which on this form means an applicant's name, telephone, email and licence number in the URL bar, the
     * history and the access log. `components/EnquiryForm.tsx` carries the long
     * version of why. With JavaScript nothing changes — the handler calls
     * `preventDefault()` first.
     */
    <form
      method="post"
      action="/api/apply"
      onSubmit={onSubmit}
      style={{ maxWidth: 'var(--measure)' }}
    >
      <Group legend="Who you are">
        <div style={twoUp}>
          <Field id="fullName" label="Your name" errors={errors.fullName}>
            <input
              id="fullName" name="fullName" required maxLength={120} autoComplete="name"
              style={inputStyle(errors.fullName)}
            />
          </Field>
          <Field id="type" label="What you are" errors={errors.type}>
            <select
              id="type" name="type" required defaultValue=""
              onChange={(e) => setType(e.target.value)}
              style={inputStyle(errors.type)}
            >
              <option value="" disabled>Choose one</option>
              {PROVIDER_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field id="phone" label="Your phone" errors={errors.phone}>
            <input
              id="phone" name="phone" type="tel" required maxLength={32} autoComplete="tel"
              style={inputStyle(errors.phone)}
            />
          </Field>
          <Field id="email" label="Your email" errors={errors.email}>
            <input
              id="email" name="email" type="email" required maxLength={200}
              autoComplete="email" style={inputStyle(errors.email)}
            />
          </Field>
        </div>

        {/*
          * Shown when it is required rather than always. § 1812.528 asks the registry to
          * inspect the licence itself and note it on the application, so this is the
          * start of that record — and a field that appears with a reason attached is
          * answered more often than one that sits there looking optional.
          */}
        {needsLicence ? (
          <div style={{ marginTop: '1rem' }}>
            <Field
              id="licenseNumber" label="Your licence number"
              hint="Required for an RN or an LVN. We check it against the Board of
                Registered Nursing or the BVNPT, and we look at the licence itself before
                you are referred to anyone."
              errors={errors.licenseNumber}
            >
              <input
                id="licenseNumber" name="licenseNumber" required maxLength={60}
                autoComplete="off" style={inputStyle(errors.licenseNumber)}
              />
            </Field>
          </div>
        ) : null}
      </Group>

      {/*
        * The group-level refusals go through `Group` rather than being printed here.
        * They were a red paragraph above each grid with no `id`, no `aria-describedby`
        * and nothing pointing at them: a rejection a sighted reader saw and nobody else
        * did. The thing that is invalid is the set of boxes, not any box, so the
        * association belongs on the fieldset — see components/intakeForm.tsx.
        */}
      <Group
        legend="Where you work"
        hint="Tick everywhere you would genuinely travel to. Nothing here commits you to
          anything — you decide case by case, and declining costs you nothing."
        errors={errors.areas}
      >
        <div style={{ marginTop: '.6rem' }}>
          <div style={checkRow}>
            {AREA_OPTIONS.map((a) => (
              <Check key={a.value} name="areas" value={a.label} label={a.label} />
            ))}
          </div>
        </div>
      </Group>

      <Group legend="What you speak" errors={errors.languages}>
        <div style={{ marginTop: '.6rem' }}>
          <div style={checkRow}>
            {LANGUAGE_OPTIONS.map((l) => (
              <Check key={l} name="languages" value={l} label={l} />
            ))}
          </div>
        </div>
      </Group>

      <Group
        legend="What you have done"
        hint="Kinds of work, not coursework you have completed. We neither run nor
          record any of that, and there is nowhere in our system to put it."
      >
        <div style={{ marginTop: '.6rem' }}>
          <div style={checkRow}>
            {SPECIALTY_OPTIONS.map((s) => (
              <Check key={s.value} name="specialties" value={s.value} label={s.label} />
            ))}
          </div>
        </div>

        <div style={{ marginTop: '1.1rem' }}>
          <Field
            id="experienceNote" label="Where you have worked (optional)"
            hint="Enough for us to confirm it in writing — who, roughly when, and what
              the work was."
            errors={errors.experienceNote}
          >
            <textarea
              id="experienceNote" name="experienceNote" rows={5} maxLength={1200}
              style={inputStyle(errors.experienceNote)}
            />
          </Field>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <Field id="message" label="Anything else (optional)" errors={errors.message}>
            <textarea
              id="message" name="message" rows={4} maxLength={2000}
              style={inputStyle(errors.message)}
            />
          </Field>
        </div>
      </Group>

      <Honeypot />
      <Submit label="Send your application" sendingLabel="Sending…" result={result} />

      <p style={{ marginTop: '1.25rem', fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
        We are a referral registry. If we refer you to a household, your working
        relationship is with them — you set your own rate, you choose what you take, and
        we do not direct or supervise your work.
      </p>
    </form>
  );
}
