/**
 * Is the database reachable?
 *
 * The marketing pages are static and need nothing. Everything behind sign-in does, and
 * without a database those routes threw a bare 500 — a stack-trace-shaped error page on
 * a public site, with nothing telling the visitor what to do instead.
 *
 * This is the same posture as the pricing page degrading to its empty state: the site
 * stays up and says something useful, rather than failing in a way that looks broken to
 * a family trying to arrange care at eight on a Sunday morning.
 */
import { cache } from 'react';
import { getDb } from '@h-hallows/core/db';

export type Availability = { ok: true } | { ok: false; reason: 'not_configured' | 'unreachable' };

/**
 * Deduplicated per request. Each portal layout probes before rendering, so without
 * this every authenticated page issued a `SELECT 1` of its own alongside the session
 * read — two round trips before any real work began.
 */
export const databaseAvailable = cache(async (): Promise<Availability> => {
  try {
    const { query } = await getDb();
    await query('SELECT 1');
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const notConfigured = message.includes('DATABASE_URL is not set');
    if (!notConfigured) console.error('[availability] database unreachable', err);
    return { ok: false, reason: notConfigured ? 'not_configured' : 'unreachable' };
  }
});
