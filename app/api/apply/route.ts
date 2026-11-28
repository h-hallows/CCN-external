/**
 * The provider application form. Writes to `provider_applications` only.
 *
 * There is no public provider signup: applications are reviewed and the operator
 * onboards. Nothing here creates a `providers` row.
 */
import type { NextRequest } from 'next/server';
import { ProviderApplicationSchema } from '@/lib/schemas/intake';
import { recordApplication } from '@/lib/intake';
import { rateLimit } from '@/lib/rateLimit';
import { notifyOperator } from '@/lib/notify';
import {
  accepted, failed, limited, many, readBody, rejected, silentlyDropped,
} from '@/lib/intakeResponse';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  if (await rateLimit(request, { key: 'apply', max: 5, windowSec: 600 })) return limited();


  // Raw body, before the schema: see app/api/inquiry/route.ts for why. `z.literal('')`
  // means a filled honeypot never reaches `parsed.data`, so the check has to happen
  // against what was actually posted.
  const body = await readBody(request);
  if (typeof body.honeypot === 'string' && body.honeypot.trim() !== '') {
    return silentlyDropped();
  }

  /*
   * The three repeated fields, in the shape the schema asks for. `postIntake`'s own
   * callback does exactly this for the JSON path and says why; this is the same
   * bridge for the browser's native POST, where one ticked box arrives as a string.
   */
  body.areas = many(body.areas);
  body.languages = many(body.languages);
  body.specialties = many(body.specialties);

  const parsed = ProviderApplicationSchema.safeParse(body);
  if (!parsed.success) return rejected(parsed.error);

  let reference: string;
  try {
    reference = await recordApplication(parsed.data);
  } catch (err) {
    console.error('[apply] could not record', err);
    return failed();
  }

  await notifyOperator({
    kind: 'provider_application',
    subject: `New application (${parsed.data.type})`,
    body: 'An application has arrived. Open the console to see it.',
    payload: { applicationId: reference, type: parsed.data.type },
  });

  return accepted('Thank you. We read every application and will be in touch.', reference);
}
