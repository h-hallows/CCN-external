import { redirect } from 'next/navigation';
import { getPortalSession } from '@/lib/session';
import {
  NOT_YET_IN_THE_PORTAL, caseDocuments, filedDocuments, filedLabel,
} from '@/lib/documents';
import { Prose, Section, Stack } from '@/components/layout';

export const dynamic = 'force-dynamic';

const CARE_LABEL: Record<string, string> = {
  companion: 'Companionship',
  personal_care: 'Personal care',
  skilled_nursing: 'Skilled nursing',
  post_surgical: 'Post-surgical recovery',
  overnight_newborn: 'Overnight newborn care',
  respite: 'Respite',
  hospice_support: 'Hospice support',
};

export default async function Documents() {
  const session = await getPortalSession();
  if (!session) redirect('/login');
  const [cases, filed] = await Promise.all([
    caseDocuments(session),
    filedDocuments(session),
  ]);

  if (cases.length === 0 && filed.length === 0) {
    return (
      <Section title="Your documents" as="h1">
        <Prose>
          <p>Documents will appear here as your engagement is set up.</p>
        </Prose>
      </Section>
    );
  }

  const size = (bytes: number) => (bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`);

  return (
    <Stack gap="lg">
      {cases.map((c) => (
        <Section
          key={c.caseId}
          label={CARE_LABEL[c.care] ?? c.care}
          title="Your documents"
          as="h1"
        >
          <Prose>
            <p style={{ color: 'var(--ink-2)' }}>
              The law requires us to give you certain things in writing, by certain
              dates. This is what you have had and when, with the text itself so you
              are not relying on us to describe it.
            </p>
          </Prose>

          <div style={{ marginTop: '1.5rem' }}>
            {c.documents.map((d) => (
              <article
                key={d.key}
                style={{
                  borderTop: '1px solid var(--line)',
                  paddingBlock: '1.25rem',
                  maxWidth: 'var(--measure)',
                }}
              >
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '.4rem 1rem', alignItems: 'baseline',
                }}>
                  <h2 style={{ fontSize: 'var(--step-0)', margin: 0 }}>{d.label}</h2>
                  <span className="label nums" style={{ marginLeft: 'auto' }}>
                    {d.state === 'delivered'
                      ? <>sent {d.on}</>
                      : <>due {d.on ?? 'before care starts'}</>}
                  </span>
                </div>

                <p style={{ margin: '.4rem 0 0', fontSize: 'var(--step--1)', color: 'var(--ink-2)' }}>
                  {d.plainly}
                </p>

                {/*
                  * The text as it stood when it was delivered, identified by version.
                  * A record that cannot say WHICH wording was given is a weaker record
                  * than one that can, and the household is the party best placed to
                  * notice if it is wrong.
                  */}
                {d.deliverable ? (
                  <details style={{ marginTop: '.75rem' }}>
                    <summary style={{ cursor: 'pointer', fontSize: 'var(--step--1)' }}>
                      Read it
                    </summary>
                    <div style={{
                      marginTop: '.75rem', padding: '1rem',
                      border: '1px solid var(--line)', background: 'var(--surface)',
                      whiteSpace: 'pre-wrap', fontSize: 'var(--step--1)',
                    }}>
                      {d.text}
                    </div>
                    <p className="label" style={{ marginTop: '.5rem' }}>
                      {d.citation} · version {d.version}
                    </p>
                  </details>
                ) : (
                  /*
                    * Not an empty panel behind a "Read it" link. A required disclosure
                    * shown as a blank document is worse than one that says plainly it
                    * is not settled yet, because the reader cannot tell the difference.
                    */
                  <p style={{
                    marginTop: '.75rem', padding: '.8rem 1rem',
                    border: '1px solid var(--line-2)',
                    fontSize: 'var(--step--1)', color: 'var(--ink-2)',
                  }}>
                    We are not showing the wording here yet — it is with our lawyers and
                    we would rather you had the final version than a draft. Ask us and we
                    will send you what we have. {d.citation}.
                  </p>
                )}
              </article>
            ))}
          </div>

        </Section>
      ))}

      {/*
        * Files, as opposed to the statutory texts above. Everything here is something
        * somebody chose to share: filing a document does not share it, so an empty list
        * means nothing has been shared rather than that nothing exists.
        *
        * Each one downloads. Nothing renders inline — a PDF opened in the page runs in
        * this origin, where a live session lives.
        */}
      <Section title="Files we have shared with you" as="h2">
        {filed.length === 0 ? (
          <Prose>
            <p style={{ color: 'var(--ink-2)' }}>
              Nothing yet. When we send you something in writing — a signed agreement, a
              letter — a copy appears here as well.
            </p>
          </Prose>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filed.map((f) => (
              <li
                key={f.id}
                style={{
                  borderTop: '1px solid var(--line)',
                  paddingBlock: '.9rem',
                  maxWidth: 'var(--measure)',
                }}
              >
                <a href={`/portal-file/${f.id}`} style={{ fontWeight: 500 }}>
                  {f.filename}
                </a>
                <p style={{
                  margin: '.2rem 0 0', fontSize: 'var(--step--1)', color: 'var(--ink-2)',
                }}>
                  {filedLabel(f.kind)} · {f.filedOn} · {size(f.byteSize)}
                  {f.note ? ` · ${f.note}` : null}
                </p>
              </li>
            ))}
          </ul>
        )}

        {/*
          * Both remaining § 4.1 items are downstream of payments, which counsel
          * question 3 blocks. Saying so is better than a screen that silently implies
          * this is the whole of your file.
          */}
        <Prose>
          <p style={{
            marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--line)',
            fontSize: 'var(--step--1)', color: 'var(--ink-3)',
          }}>
            Not here yet: {NOT_YET_IN_THE_PORTAL.join(' and ')}. Ask us and we will send
            them to you directly while we build that part.
          </p>
        </Prose>
      </Section>
    </Stack>
  );
}
