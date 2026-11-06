import { NextResponse } from 'next/server';
import { getPortalSession } from '@/lib/session';
import { asPortalUser } from '@/lib/portalDb';

export const dynamic = 'force-dynamic';

/**
 * Hand a shared document to the household or provider it was shared with.
 *
 * THE AUTHORISATION IS THE POLICY, not a check in this file. The query runs as the
 * signed-in portal user, so `documents_household_select` and
 * `documents_provider_select` decide what comes back: shared, unredacted, and theirs.
 * A row that does not satisfy those is not "403" — it is not there, and this route
 * cannot tell the difference between a document that does not exist and one belonging
 * to another family. That is the right amount for it to know.
 *
 * ALWAYS AN ATTACHMENT. A PDF rendered inline runs in this origin, where a live portal
 * session lives. The operator's console does the same, for the same reason.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { documentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const [doc] = await asPortalUser(session, (tx) => tx.query<{
    filename: string; content_type: string; bytes: Buffer | null;
  }>(
    `SELECT filename, content_type, bytes FROM documents WHERE id = $1`,
    [documentId],
  ));

  if (!doc?.bytes) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const safe = doc.filename.replace(/["\\\r\n]/g, '_');
  const bytes = Buffer.from(doc.bytes);

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'content-type': doc.content_type,
      'content-disposition': `attachment; filename="${safe}"`,
      'content-length': String(bytes.length),
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store, max-age=0',
    },
  });
}
