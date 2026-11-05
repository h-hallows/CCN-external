'use client';

/**
 * The household's own document, edited in place. Web build spec § 4.1, W7.
 *
 * Autosave with a visible saved state, and on failure the draft stays. That last part
 * is the requirement that shapes the component: somebody is typing what matters about
 * their mother at three in the morning, and losing it to a dropped connection is not
 * an acceptable outcome. The text stays in the textarea, a copy goes to localStorage,
 * and the page says plainly that it has not saved yet.
 *
 * localStorage is a convenience and never the source of truth. It can throw in a
 * private window and comes back empty on another device, so every access is guarded and
 * the component renders correctly without it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { saveProfile } from '@/app/(client)/portal/profile/actions';
import { PROFILE_MAX } from '@/lib/profileLimits';

type Status =
  | { state: 'idle' }
  | { state: 'typing' }
  | { state: 'saving' }
  | { state: 'saved'; at: string }
  | { state: 'failed'; message: string };

const SAVE_AFTER_MS = 1200;

function draftKey(caseId: string): string {
  return `ccn.profile.draft.${caseId}`;
}

function readDraft(caseId: string): string | null {
  try {
    return window.localStorage.getItem(draftKey(caseId));
  } catch {
    return null;
  }
}

function writeDraft(caseId: string, body: string): void {
  try {
    window.localStorage.setItem(draftKey(caseId), body);
  } catch { /* private window, or storage is full. The textarea still holds it. */ }
}

function clearDraft(caseId: string): void {
  try {
    window.localStorage.removeItem(draftKey(caseId));
  } catch { /* nothing to do, and nothing depends on it */ }
}

function clockTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function HouseholdProfile({
  caseId,
  initial,
  readBy,
}: {
  caseId: string;
  initial: string;
  readBy: string | null;
}) {
  const [body, setBody] = useState(initial);
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(initial);

  // An unsaved draft from a previous visit wins over the stored copy, because the only
  // way one exists is that a save failed after the household had typed something.
  useEffect(() => {
    const draft = readDraft(caseId);
    if (draft !== null && draft !== initial) {
      setBody(draft);
      latest.current = draft;
      setStatus({
        state: 'failed',
        message: 'This has not saved yet. It is still here — we will try again as soon as you make a change.',
      });
    }
  }, [caseId, initial]);

  const commit = useCallback(async (value: string) => {
    setStatus({ state: 'saving' });
    const result = await saveProfile(caseId, value);
    // A later keystroke has already queued another save; let that one report.
    if (latest.current !== value) return;

    if (result.ok) {
      clearDraft(caseId);
      setStatus({ state: 'saved', at: result.savedAt ?? new Date().toISOString() });
    } else {
      writeDraft(caseId, value);
      setStatus({ state: 'failed', message: result.message ?? 'We could not save that just now.' });
    }
  }, [caseId]);

  function onChange(value: string) {
    setBody(value);
    latest.current = value;
    setStatus({ state: 'typing' });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void commit(value); }, SAVE_AFTER_MS);
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <div style={{ maxWidth: 'var(--measure)' }}>
      <textarea
        aria-label="What someone covering a shift should know"
        value={body}
        maxLength={PROFILE_MAX}
        rows={14}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (timer.current) clearTimeout(timer.current);
          if (latest.current !== initial) void commit(latest.current);
        }}
        placeholder={PLACEHOLDER}
        style={{
          width: '100%', padding: '.9rem 1rem',
          border: '1px solid var(--line-2)', background: 'var(--surface)',
          color: 'var(--ink)', font: 'inherit', fontSize: 'var(--step--1)',
          lineHeight: 1.6, resize: 'vertical',
        }}
      />

      <p
        role="status"
        aria-live="polite"
        style={{
          marginTop: '.5rem', fontSize: 'var(--step--1)',
          color: status.state === 'failed' ? 'var(--ink)' : 'var(--ink-3)',
          minHeight: '1.4em',
        }}
      >
        {status.state === 'saving' ? 'Saving…' : null}
        {status.state === 'typing' ? 'Not saved yet' : null}
        {status.state === 'saved' ? `Saved at ${clockTime(status.at)}` : null}
        {status.state === 'failed' ? status.message : null}
        {status.state === 'idle' ? 'Saves by itself as you write.' : null}
      </p>

      <p style={{ marginTop: '.75rem', fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
        {readBy
          ? `${readBy} can read this, and so can anyone covering a shift instead.`
          : 'Anyone who covers a shift for you can read this.'}
        {' '}
        It travels with the work, so somebody arriving at seven in the morning knows
        what you would have told them at the door.
      </p>
    </div>
  );
}

/** Examples, marked as examples. Not a template, and nothing fills them in. */
const PLACEHOLDER = `For example:

She is usually up by 6.30 and likes the radio on before anyone speaks to her.

The side gate code is easier than the front door. The dog barks and then settles.

If she is unsettled at 3am it is almost always her hip, not confusion. Sitting up for twenty minutes helps more than anything else.`;
