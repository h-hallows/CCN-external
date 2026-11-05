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
 */
import { useState } from 'react';
import { fieldStyle } from '@/components/SaveForm';

const ROLES: { value: string; label: string }[] = [
  { value: 'discharge_planner', label: 'Discharge planner' },
  { value: 'care_manager', label: 'Geriatric care manager' },
  { value: 'physician', label: 'Physician' },
  { value: 'surgical_practice', label: 'Surgical practice' },
  { value: 'attorney', label: 'Attorney' },
  { value: 'family_office', label: 'Family office' },
  { value: 'other', label: 'Something else' },
];

const CARE_TYPES: { value: string; label: string }[] = [
  { value: 'post_surgical', label: 'Post-surgical recovery' },
  { value: 'skilled_nursing', label: 'Skilled nursing' },
  { value: 'personal_care', label: 'Personal care' },
  { value: 'companion', label: 'Companionship' },
  { value: 'overnight_newborn', label: 'Overnight newborn care' },
  { value: 'hospice_support', label: 'Hospice support' },
  { value: 'respite', label: 'Respite' },
  { value: 'not_sure', label: 'Not sure yet' },
];

const AREAS: { value: string; label: string }[] = [
  { value: 'century_city', label: 'Century City' },
  { value: 'beverly_hills', label: 'Beverly Hills' },
  { value: 'westwood', label: 'Westwood' },
  { value: 'brentwood', label: 'Brentwood' },
  { value: 'bel_air', label: 'Bel Air' },
  { value: 'holmby_hills', label: 'Holmby Hills' },
  { value: 'santa_monica', label: 'Santa Monica' },
  { value: 'pacific_palisades', label: 'Pacific Palisades' },
  { value: 'malibu', label: 'Malibu' },
  { value: 'other', label: 'Elsewhere' },
];

/** Deliberately plain. Urgency decides how fast we move, not what it costs. */
const URGENCIES: { value: string; label: string }[] = [
  { value: 'discharge', label: 'Discharging now' },
  { value: 'same_day', label: 'Today' },
  { value: 'next_day', label: 'Tomorrow' },
  { value: 'routine', label: 'In the next week or two' },
];

type State =
  | { state: 'idle' }
  | { state: 'sending' }
  | { state: 'sent'; message: string; reference: string }
  | { state: 'error'; message: string };

function Field({
  id, label, children,
}: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label" style={{ display: 'block', marginBottom: '.35rem' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const twoUp: React.CSSProperties = {
  display: 'grid', gap: '1rem', marginTop: '1rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
};

export function PartnerReferralForm({
  acknowledgedBy, directLine,
}: { acknowledgedBy: string | null; directLine: string | null }) {
  const [result, setResult] = useState<State>({ state: 'idle' });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult({ state: 'sending' });

    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string') body[key] = value;
    }
    body.consentNote = form.get('consentNote') === 'on';

    try {
      const response = await fetch('/api/refer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as {
        ok?: boolean; message?: string; reference?: string;
      };
      if (!response.ok || !payload.ok) {
        setResult({
          state: 'error',
          message: payload.message
            ?? 'We could not take that just now. Please call us instead — it is quicker anyway.',
        });
        return;
      }
      setResult({
        state: 'sent',
        message: payload.message ?? 'Received.',
        reference: payload.reference ?? '',
      });
    } catch {
      setResult({
        state: 'error',
        message: 'We could not take that just now. Please call us instead.',
      });
    }
  }

  if (result.state === 'sent') {
    return (
      <div
        role="status"
        style={{
          border: '1px solid var(--line-2)', padding: '1.25rem',
          maxWidth: 'var(--measure)',
        }}
      >
        <p style={{ marginTop: 0 }}>{result.message}</p>
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
        {result.reference ? (
          <p className="label nums">Your reference: {result.reference}</p>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 'var(--measure)' }}>
      <fieldset style={{ border: 0, padding: 0, margin: '0 0 2rem' }}>
        <legend style={{ fontSize: 'var(--step-0)' }}>Who you are</legend>
        <div style={twoUp}>
          <Field id="partnerName" label="Your name">
            <input id="partnerName" name="partnerName" required maxLength={120} style={fieldStyle} />
          </Field>
          <Field id="partnerOrg" label="Where you work">
            <input id="partnerOrg" name="partnerOrg" maxLength={160} style={fieldStyle} />
          </Field>
          <Field id="partnerRole" label="Your role">
            <select id="partnerRole" name="partnerRole" required defaultValue="" style={fieldStyle}>
              <option value="" disabled>Choose one</option>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
          <Field id="partnerPhone" label="Your phone">
            <input id="partnerPhone" name="partnerPhone" type="tel" required maxLength={32} style={fieldStyle} />
          </Field>
          <Field id="partnerEmail" label="Your email">
            <input id="partnerEmail" name="partnerEmail" type="email" required maxLength={200} style={fieldStyle} />
          </Field>
        </div>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: '0 0 2rem' }}>
        <legend style={{ fontSize: 'var(--step-0)' }}>Who the patient is</legend>
        <p style={{ fontSize: 'var(--step--1)', color: 'var(--ink-3)', margin: '.4rem 0 0' }}>
          Initials only at this stage. We do not need a name until the family has
          spoken to us themselves.
        </p>
        <div style={twoUp}>
          <Field id="patientInitials" label="Patient initials">
            <input id="patientInitials" name="patientInitials" required maxLength={8} style={fieldStyle} />
          </Field>
          <Field id="careType" label="What they need">
            <select id="careType" name="careType" required defaultValue="" style={fieldStyle}>
              <option value="" disabled>Choose one</option>
              {CARE_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field id="area" label="Where">
            <select id="area" name="area" required defaultValue="" style={fieldStyle}>
              <option value="" disabled>Choose one</option>
              {AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </Field>
          <Field id="urgency" label="When">
            <select id="urgency" name="urgency" required defaultValue="" style={fieldStyle}>
              <option value="" disabled>Choose one</option>
              {URGENCIES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: '0 0 2rem' }}>
        <legend style={{ fontSize: 'var(--step-0)' }}>Who we should call</legend>
        <div style={twoUp}>
          <Field id="contactName" label="Their name">
            <input id="contactName" name="contactName" required maxLength={120} style={fieldStyle} />
          </Field>
          <Field id="contactPhone" label="Their phone">
            <input id="contactPhone" name="contactPhone" type="tel" required maxLength={32} style={fieldStyle} />
          </Field>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <Field id="note" label="Anything we should know (optional)">
            <textarea id="note" name="note" rows={4} maxLength={1200} style={fieldStyle} />
          </Field>
        </div>

        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: '.5rem',
          marginTop: '1.1rem', fontSize: 'var(--step--1)',
        }}>
          <input type="checkbox" name="consentNote" required style={{ marginTop: '.2rem' }} />
          <span>
            The family have agreed I can pass their contact details to you.
          </span>
        </label>
      </fieldset>

      {/* Not hidden with display:none, which some bots check for. */}
      <div aria-hidden style={{ position: 'absolute', left: '-9999px' }}>
        <label htmlFor="honeypot">Leave this empty</label>
        <input id="honeypot" name="honeypot" tabIndex={-1} autoComplete="off" />
      </div>

      <button type="submit" className="btn btn-primary" disabled={result.state === 'sending'}>
        {result.state === 'sending' ? 'Sending…' : 'Send this to us'}
      </button>

      {result.state === 'error' ? (
        <p role="status" style={{ marginTop: '1rem', fontSize: 'var(--step--1)' }}>
          {result.message}
        </p>
      ) : null}
    </form>
  );
}
