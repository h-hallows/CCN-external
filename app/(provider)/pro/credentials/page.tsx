import { redirect } from 'next/navigation';
import { LABEL } from '@h-hallows/core/domain';
import { getPortalSession } from '@/lib/session';
import { credentialStanding } from '@/lib/pro';
import { SaveForm, fieldStyle } from '@/components/SaveForm';
import { handInCredential } from '../actions';
import { Prose, Section, Stack } from '@/components/layout';

export const dynamic = 'force-dynamic';

const STATE_WORDS: Record<string, string> = {
  missing: 'We do not have this yet',
  expired: 'Out of date',
  critical: 'Runs out within a week',
  soon: 'Runs out within a month',
  upcoming: 'Runs out in the next three months',
  valid: 'On file',
  none: 'On file, no expiry',
};

export default async function ProCredentials() {
  const session = await getPortalSession();
  if (!session) redirect('/login');
  const standing = await credentialStanding(session);
  if (!standing) redirect('/login');

  const required = standing.credentials.filter((c) => c.required);
  const other = standing.credentials.filter((c) => !c.required);

  return (
    <Stack gap="lg">
      <Section title="Your documents" as="h1">
        <Prose>
          <p>
            We verify each document against the body that issued it and record the
            expiry ourselves. That is why you cannot enter an expiry date here — a date
            typed into a form is not evidence of anything, and the checking is the part
            households are relying on.
          </p>
          <p style={{ fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
            Send us what you have and we will do the rest. If something is already out
            of date we will say so rather than quietly stop putting you forward.
          </p>
        </Prose>

        <div style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: 'var(--step-0)' }}>What your work needs</h2>
          <div className="scroller">
            <table>
              <thead>
                <tr>
                  <th scope="col">Document</th>
                  <th scope="col">Where it stands</th>
                  <th scope="col">Expires</th>
                </tr>
              </thead>
              <tbody>
                {required.map((c) => (
                  <tr key={c.type}>
                    <th scope="row" style={{ fontWeight: 400 }}>{c.label}</th>
                    <td>
                      {STATE_WORDS[c.state] ?? c.state}
                      {c.staleVerification ? (
                        /* Not a problem for them — it is our re-check that is
                           overdue, and saying so is more honest than letting it
                           sit in a queue they cannot see. */
                        <span style={{ color: 'var(--ink-3)' }}>
                          {' '}&middot; due a re-check by us
                        </span>
                      ) : null}
                      {c.submittedAt ? (
                        <span style={{ color: 'var(--ink-3)' }}>
                          {' '}&middot; you sent something on{' '}
                          <span className="nums">{c.submittedAt}</span>, we are checking it
                        </span>
                      ) : null}
                    </td>
                    <td className="nums">{c.expiresOn ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {other.length > 0 ? (
            <div style={{ marginTop: '1.5rem' }}>
              <h2 style={{ fontSize: 'var(--step-0)' }}>Also on file</h2>
              <div className="scroller">
                <table>
                  <tbody>
                    {other.map((c) => (
                      <tr key={c.type}>
                        <th scope="row" style={{ fontWeight: 400 }}>{c.label}</th>
                        <td>{STATE_WORDS[c.state] ?? c.state}</td>
                        <td className="nums">{c.expiresOn ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </Section>

      <Section title="Send us a document" as="h2">
        {/*
          * Writes to `credential_submissions`, never to `credentials`. Migration 0008
          * dropped the provider insert policy on the latter after it was found that a
          * provider could insert their own Live Scan and become eligible for referral,
          * because eligibility() counts the presence of a row of the required type.
          * Nothing computes eligibility from a submission.
          */}
        <SaveForm
          action={handInCredential}
          label="Send it to us"
          footnote="This goes into our queue. It does not change what you are eligible for until we have checked it — that step is the one that matters."
        >
          <label htmlFor="type" className="label" style={{ display: 'block', marginBottom: '.35rem' }}>
            What is it
          </label>
          <select id="type" name="type" defaultValue="" style={fieldStyle}>
            <option value="" disabled>Choose one</option>
            {Object.entries(LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <label htmlFor="identifier" className="label" style={{ display: 'block', margin: '1.1rem 0 .35rem' }}>
            Its number, if it has one
          </label>
          <input id="identifier" name="identifier" type="text" maxLength={120} style={fieldStyle} />

          <label htmlFor="documentUrl" className="label" style={{ display: 'block', margin: '1.1rem 0 .35rem' }}>
            A link to it
          </label>
          <input id="documentUrl" name="documentUrl" type="url" maxLength={500} style={fieldStyle} />

          <label htmlFor="note" className="label" style={{ display: 'block', margin: '1.1rem 0 .35rem' }}>
            Anything we should know (optional)
          </label>
          <textarea id="note" name="note" rows={3} maxLength={1000} style={fieldStyle} />
        </SaveForm>
      </Section>
    </Stack>
  );
}
