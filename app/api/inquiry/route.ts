/** The household enquiry form. Writes to `inquiries` only. Spec § 3.2. */
import type { NextRequest } from 'next/server';
import { CONFIRMATION, InquirySchema } from '@/lib/schemas/intake';
import { recordInquiry } from '@/lib/intake';
import { rateLimit } from '@/lib/rateLimit';
import { notifyOperator } from '@/lib/notify';
import { accepted, failed, limited, readBody, rejected, silentlyDropped } from '@/lib/intakeResponse';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  if (await rateLimit(request, { key: 'inquiry', max: 5, windowSec: 600 })) return limited();


  /*
   * THE HONEYPOT IS CHECKED AGAINST THE RAW BODY, BEFORE THE SCHEMA.
   *
   * It was checked after, as `parsed.data.honeypot`, and the field's type is
   * `z.literal('').optional()` — so the only values that ever reach `parsed.data` are
   * `''` and `undefined`, both falsy. `silentlyDropped()` could not be reached from
   * any route in the application. It was present, correct, documented, asserted in
   * tests/intakeResponse.test.ts, green, and dead.
   *
   * What a bot got instead was a 400 whose `fieldErrors` are keyed by field name — so
   * the response named `honeypot` to the one caller the field exists to catch, which
   * is precisely what the comment on `silentlyDropped` says must not happen: telling a
   * bot it was detected teaches whoever wrote it to stop filling the field.
   *
   * The schema is not the place to fix it — `lib/schemas/intake.ts` is `.strict()` on
   * purpose and a looser honeypot field would be a hole in that posture. So the raw
   * body answers the question first, and the strict schema still refuses everything
   * else.
   */
  const body = await readBody(request);
  if (typeof body.honeypot === 'string' && body.honeypot.trim() !== '') {
    return silentlyDropped();
  }

  const parsed = InquirySchema.safeParse(body);
  if (!parsed.success) return rejected(parsed.error);

  let reference: string;
  try {
    reference = await recordInquiry(parsed.data);
  } catch (err) {
    console.error('[inquiry] could not record', err);
    return failed();
  }

  // Nothing identifying in the subject or body — spec § 7. The console has the detail.
  await notifyOperator({
    kind: 'inquiry',
    urgency: parsed.data.urgency,
    subject: `New enquiry (${parsed.data.urgency.replace('_', ' ')})`,
    body: 'An enquiry has arrived. Open the console to see it.',
    payload: { inquiryId: reference, urgency: parsed.data.urgency },
  });

  return accepted(CONFIRMATION[parsed.data.urgency], reference);
}
