/**
 * Readiness, for diagnosing a deploy without reading build logs.
 *
 * Reports what is configured, by name only — never a value. All of these names are
 * already public in this repository, and when a deployment misbehaves the first
 * question is always which variable is missing.
 */
import { databaseAvailable } from '@/lib/availability';
import {
  brandBlockers, contactResolved, indexable, legalNameResolved, nameIsFiled,
} from '@/lib/brand';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const db = await databaseAvailable();
  const blockers = brandBlockers();

  const body = {
    ok: db.ok && blockers.length === 0,
    database: db.ok ? 'ok' : db.reason,
    brand: {
      legalName: legalNameResolved(),
      contact: contactResolved(),
      /**
       * Whether anyone has said the configured name is the one on file. A stand-in
       * renders the whole site and is never indexed; see lib/brand.ts.
       */
      nameIsFiled: nameIsFiled(),
      indexable: indexable(),
      blockers,
    },
    marketingPagesServeWithoutADatabase: true,
    signedInSurfacesNeedADatabase: ['/login', '/portal', '/invite/[token]', '/api/*'],
  };

  return Response.json(body, {
    status: body.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}
