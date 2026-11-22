/**
 * Live rate ranges. Spec § 5.
 *
 * Never written into page content. A published rate that has drifted from reality is
 * both a conversion problem and, under § 1812.533(b)(1), a misleading advertisement —
 * so the number on the page comes from the table the operator maintains, revalidated
 * hourly, and a test asserts no MDX or page file contains a rate figure.
 *
 * The range is what is shown, and it is shown as a range on purpose: the provider sets
 * their rate and it stays negotiable with the household (I5). A single number would
 * read as a price list, which this is not.
 */
import { getDb } from '@h-hallows/core/db';

export const RATE_REVALIDATE_SECONDS = 3600;

export type CredentialLevel = 'companion' | 'hca' | 'cna' | 'lvn' | 'rn';

export interface RateRange {
  serviceKey: string;
  credentialLevel: CredentialLevel;
  low: number;
  high: number;
  note: string | null;
}

export const CREDENTIAL_LABEL: Record<CredentialLevel, string> = {
  companion: 'Companion',
  hca: 'Home care aide',
  cna: 'Certified nursing assistant',
  lvn: 'Licensed vocational nurse',
  rn: 'Registered nurse',
};

/** Ordered as a household would read them: least clinical first. */
export const CREDENTIAL_ORDER: CredentialLevel[] = ['companion', 'hca', 'cna', 'lvn', 'rn'];

/**
 * The ranges in force today. Only the newest row per service and level whose
 * effective_from has arrived — a future-dated change is posted but not yet live.
 */
/**
 * Returns [] rather than throwing when the database is unreachable.
 *
 * The pricing page is prerendered, so a throw here fails the build — and a marketing
 * site that cannot deploy because the rates table blipped is a worse outcome than one
 * that says "call us for current ranges" for an hour until the next revalidation. The
 * page has that empty state already.
 */
export async function currentRateRanges(serviceKey?: string): Promise<RateRange[]> {
  return (await rateState(serviceKey)).ranges;
}

export interface RateState {
  ranges: RateRange[];
  /**
   * True when the table could not be read at all, as opposed to having nothing posted.
   *
   * Two different pages for a reader. "Nobody has posted a band for respite care" and
   * "we could not reach our own records just now" are not the same sentence, and the
   * empty state said the second thing for both.
   *
   * It also matters for the cache. This page is ISR on a one-hour revalidate, so a
   * failed read that returns [] is a SUCCESSFUL render of the empty state, and Next
   * caches it for the full hour — on `/pricing` and on all ten crossed landing pages at
   * once. Throwing would make Next keep serving the last good page instead, which is
   * what we want in production and not what we want during the build: the pages are
   * prerendered, so a throw fails the deploy over a blip. Recorded in DEFERRED.md
   * rather than guessed at; what this flag buys today is copy that is true.
   */
  unavailable: boolean;
}

export async function rateState(serviceKey?: string): Promise<RateState> {
  try {
    return { ranges: await fetchRateRanges(serviceKey), unavailable: false };
  } catch (err) {
    console.error('[rates] could not read rate_ranges; rendering the empty state', err);
    return { ranges: [], unavailable: true };
  }
}

async function fetchRateRanges(serviceKey?: string): Promise<RateRange[]> {
  const { query } = await getDb();
  const rows = await query<{
    service_key: string; credential_level: string; low: string; high: string; note: string | null;
  }>(
    /*
     * `posted_by <> 'seed'` is a publishing decision, not a tidy-up.
     *
     * `rate_ranges` carries who posted each band and when (core migration 0026). The
     * seed writes fourteen demonstration bands so the pricing page has something to
     * render in development — and this query did not look at the column, so attaching
     * a seeded database to the public site published all fourteen as the registry's own
     * claim about what care costs. On the first load of the console's new `/rates`
     * screen, 14 of 14 live bands were still authored by the seed.
     *
     * § 1812.533(b)(1) prohibits publishing false or misleading information about the
     * services a registry refers for. A number nobody at this registry posted is not a
     * claim it is entitled to make, so the page shows its empty state — "call and we
     * will tell you what we are seeing this week" — until an operator posts one. That
     * is honest, it converts worse, and the console says exactly what to do about it.
     */
    `SELECT DISTINCT ON (service_key, credential_level)
            service_key, credential_level, low::text, high::text, note
       FROM rate_ranges
      WHERE effective_from <= (now() AT TIME ZONE 'America/Los_Angeles')::date
        AND posted_by <> 'seed'
        AND ($1::text IS NULL OR service_key = $1)
      ORDER BY service_key, credential_level, effective_from DESC`,
    [serviceKey ?? null],
  );

  return rows.map((r) => ({
    serviceKey: r.service_key,
    credentialLevel: r.credential_level as CredentialLevel,
    low: Number(r.low),
    high: Number(r.high),
    note: r.note,
  }));
}

export function formatRange(r: RateRange): string {
  return `$${r.low.toFixed(0)}–$${r.high.toFixed(0)} an hour`;
}
