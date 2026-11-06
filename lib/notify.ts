/**
 * Operator notifications. Spec § 7, transactional only — no marketing, no sequences.
 *
 * THE RULE THAT SHAPES THIS: no provider name, household name, care recipient name,
 * address or clinical detail in a subject or body. Email is not a confidential channel
 * and this clientele is discretion-first, so the message says something is ready and the
 * console says what. It also keeps CCN clear of whether an unencrypted email carrying
 * care details is defensible.
 *
 * THE ROW IS THE RECORD. It is written first and a send failure never undoes it: a
 * notification that exists only as an attempted email is one nobody can go back and
 * find. The email is a nudge towards the console, not the thing itself.
 *
 * Because the message carries no identifying detail — that is the rule above, and a test
 * asserts it — emailing it is safe in a way that emailing the content would not be. The
 * email says something arrived; the console says what, and to whom.
 */
import { getDb } from '@h-hallows/core/db';
import { mailConfigured, sendMail } from '@h-hallows/core/mail';

export type NotificationKind =
  | 'inquiry' | 'provider_application' | 'partner_referral' | 'shortlist_request'
  | 'shortlist_published' | 'written_statement_due' | 'nurse_disclosure_outstanding'
  | 'credential_expiring' | 'portal_invite';

export type Urgency = 'discharge' | 'same_day' | 'next_day' | 'routine';

export interface Notification {
  kind: NotificationKind;
  urgency?: Urgency;
  /** Says that something arrived. Never what, or whose. */
  subject: string;
  body: string;
  /** Everything the console needs. Never reaches an inbox. */
  payload?: Record<string, unknown>;
}

/** Terms that must never appear in a subject or body. Asserted in a test, not just here. */
const IDENTIFYING_KEYS = ['name', 'address', 'phone', 'email', 'diagnosis', 'patient'];

export async function notifyOperator(n: Notification): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    for (const key of IDENTIFYING_KEYS) {
      if (`${n.subject} ${n.body}`.toLowerCase().includes(key)) {
        console.warn(
          `[notify] "${key}" appears in a notification subject or body. Spec § 7 keeps `
          + 'identifying detail out of the message and in the console.',
        );
      }
    }
  }

  try {
    const { query } = await getDb();
    await query(
      `INSERT INTO operator_notifications (kind, urgency, subject, body, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [n.kind, n.urgency ?? null, n.subject, n.body, JSON.stringify(n.payload ?? {})],
    );
  } catch (err) {
    // The submission is already recorded. Losing the notification is bad; losing the
    // enquiry because the notification failed would be worse.
    console.error('[notify] could not queue', n.kind, err);
  }

  await nudgeOperator(n);
}

/**
 * Tell the operator to look, if there is somewhere to tell them.
 *
 * `payload` is excluded on purpose. It is everything the console needs and some of it
 * identifies a family; § 7 keeps that out of an inbox. Only the subject and body — both
 * written to say that something arrived and not what — go out.
 *
 * Failures are swallowed. This runs after a submission the visitor has already been
 * thanked for, and an unreachable mail provider must not turn their enquiry into an
 * error page.
 */
async function nudgeOperator(n: Notification): Promise<void> {
  const to = process.env.OPERATOR_NOTIFY_EMAIL?.trim();
  if (!to || !mailConfigured()) return;

  try {
    const outcome = await sendMail({
      to,
      subject: n.urgency === 'discharge' || n.urgency === 'same_day'
        ? `${n.subject} — today`
        : n.subject,
      text: `${n.body}\n\nThe console has the detail. This message deliberately does not.`,
    });
    if (!outcome.delivered) {
      console.error('[notify] could not send', n.kind, outcome.reason);
    }
  } catch (err) {
    console.error('[notify] could not send', n.kind, err);
  }
}
