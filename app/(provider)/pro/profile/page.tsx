import { redirect } from 'next/navigation';
import { getPortalSession } from '@/lib/session';
import { BIO_MAX, providerSelf } from '@/lib/pro';
import { SaveForm, fieldStyle } from '@/components/SaveForm';
import { updatePhoto, updateProfile } from '../actions';
import { Prose, Section, Stack } from '@/components/layout';

export const dynamic = 'force-dynamic';

export default async function ProProfile() {
  const session = await getPortalSession();
  if (!session) redirect('/login');
  const me = await providerSelf(session);
  if (!me) redirect('/login');

  return (
    <Stack gap="lg">
      <Section title="About you" as="h1">
        <Prose>
          <p>
            What households read before they meet you. Your words, shown as you write
            them — we do not edit, shorten or rewrite any of it.
          </p>
          <p style={{ fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
            Your legal name, your type and your licence are on your record and only we
            can change those. If any of them is wrong, tell us and we will correct it.
          </p>
        </Prose>

        <div style={{ marginTop: '1.5rem' }}>
          <SaveForm action={updateProfile}>
            <label htmlFor="preferredName" className="label" style={{ display: 'block', marginBottom: '.35rem' }}>
              What you would like to be called
            </label>
            <input
              id="preferredName" name="preferredName" type="text" maxLength={120}
              defaultValue={me.preferredName ?? ''} style={fieldStyle}
              placeholder={me.fullName}
            />

            <label htmlFor="bio" className="label" style={{ display: 'block', margin: '1.1rem 0 .35rem' }}>
              About your work
            </label>
            <textarea
              id="bio" name="bio" rows={8} maxLength={BIO_MAX}
              defaultValue={me.bio ?? ''} style={fieldStyle}
              placeholder="Twelve years on post-surgical recovery, mostly orthopaedic. I am used to working alongside a physiotherapist and I am comfortable with a hoist."
            />

            <div style={{
              display: 'grid', gap: '1rem', marginTop: '1.1rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
            }}>
              <div>
                <label htmlFor="phone" className="label" style={{ display: 'block', marginBottom: '.35rem' }}>
                  Phone
                </label>
                <input id="phone" name="phone" type="tel" maxLength={32}
                  defaultValue={me.phone ?? ''} style={fieldStyle} />
              </div>
              <div>
                <label htmlFor="email" className="label" style={{ display: 'block', marginBottom: '.35rem' }}>
                  Email
                </label>
                <input id="email" name="email" type="email" maxLength={200}
                  defaultValue={me.email ?? ''} style={fieldStyle} />
              </div>
            </div>
          </SaveForm>
        </div>
      </Section>

      <Section title="Your photograph" as="h2">
        <Prose>
          <p>
            Optional, and it stays optional. We will not show a photograph of you
            unless you have told us we may, and we record the date you did.
          </p>
          {me.photoConsentOn ? (
            <p style={{ fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
              You agreed on <span className="nums">{me.photoConsentOn}</span>. Clearing
              the link below removes both the photograph and that record.
            </p>
          ) : null}
        </Prose>

        <div style={{ marginTop: '1.25rem' }}>
          <SaveForm
            action={updatePhoto}
            label="Save photograph"
            footnote="Stored with your agreement in the same step, or not at all — the database will not keep a photograph of you without it."
          >
            <label htmlFor="photoUrl" className="label" style={{ display: 'block', marginBottom: '.35rem' }}>
              Link to your photograph (leave empty to remove it)
            </label>
            <input id="photoUrl" name="photoUrl" type="url" maxLength={500}
              defaultValue={me.photoUrl ?? ''} style={fieldStyle} />

            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '.5rem',
              marginTop: '.85rem', fontSize: 'var(--step--1)',
            }}>
              <input type="checkbox" name="consent" value="yes"
                defaultChecked={Boolean(me.photoConsentOn)} style={{ marginTop: '.2rem' }} />
              <span>
                I am happy for this photograph to be shown to households considering
                working with me.
              </span>
            </label>
          </SaveForm>
        </div>
      </Section>
    </Stack>
  );
}
