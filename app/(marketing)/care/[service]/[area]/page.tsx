import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CROSSED_PAGES, areaName, crossedPage } from '@/content/crossed';
import { crossedPath, faqJsonLd } from '@/lib/crossed';
import {
  CREDENTIAL_LABEL, CREDENTIAL_ORDER, currentRateRanges, formatRange,
} from '@/lib/rates';
import { siteUrl } from '@/lib/site';
import { Prose, Section, Stack } from '@/components/layout';

/**
 * A service × area page. Web build spec § 5, W10.
 *
 * Hourly ISR rather than force-dynamic: the content is editorial and changes when
 * somebody edits it, but the rate ranges come from a table the operator maintains and
 * a published rate that has drifted is a misleading advertisement under
 * § 1812.533(b)(1). An hour is short enough that a corrected range is live the same
 * morning, and long enough that these pages are static for almost every visitor.
 */
// A literal, not RATE_REVALIDATE_SECONDS. Next parses segment config statically and
// refuses an imported constant — "Invalid segment configuration export detected" — so
// the two are kept equal by a test rather than by an import.
export const revalidate = 3600;

export function generateStaticParams(): { service: string; area: string }[] {
  return CROSSED_PAGES.map(({ service, area }) => ({ service, area }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ service: string; area: string }> },
): Promise<Metadata> {
  const { service, area } = await params;
  const page = crossedPage(service, area);
  if (!page) return {};
  return {
    title: page.title,
    description: page.summary,
    alternates: { canonical: `${siteUrl()}${crossedPath(page)}` },
    openGraph: { title: page.title, description: page.summary, type: 'article' },
  };
}

export default async function CrossedPage(
  { params }: { params: Promise<{ service: string; area: string }> },
) {
  const { service, area } = await params;
  const page = crossedPage(service, area);
  if (!page) notFound();

  // Live, never written into the content. Empty is a real state: the page says "call
  // us" rather than showing a stale figure.
  const ranges = await currentRateRanges(page.rateKey);
  const ordered = CREDENTIAL_ORDER
    .map((level) => ranges.find((r) => r.credentialLevel === level))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  const nearby = CROSSED_PAGES.filter(
    (p) => p !== page && (p.service === page.service || p.area === page.area));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(page)) }}
      />

      <Stack gap="lg">
        <Section title={page.title} as="h1">
          <Prose>
            <p style={{ fontSize: 'var(--step-1)', color: 'var(--ink-2)' }}>{page.summary}</p>
            {page.body.map((paragraph) => <p key={paragraph.slice(0, 40)}>{paragraph}</p>)}
          </Prose>
        </Section>

        <Section title={`What we see in ${areaName(page.area)}`} as="h2">
          <Prose>
            <ul>
              {page.localContext.map((item) => <li key={item.slice(0, 40)}>{item}</li>)}
            </ul>
          </Prose>
        </Section>

        <Section title="What people usually need" as="h2">
          <Prose>
            <ul>
              {page.commonCases.map((item) => <li key={item.slice(0, 40)}>{item}</li>)}
            </ul>
          </Prose>
        </Section>

        <Section title="What this costs" as="h2">
          <Prose>
            {ordered.length === 0 ? (
              <p>
                Call us for current ranges. We would rather say that than publish a
                figure that has drifted.
              </p>
            ) : (
              <>
                <table style={{ maxWidth: 'var(--measure)' }}>
                  <tbody>
                    {ordered.map((r) => (
                      <tr key={r.credentialLevel}>
                        <th scope="row" style={{ fontWeight: 400 }}>
                          {CREDENTIAL_LABEL[r.credentialLevel]}
                        </th>
                        <td className="nums">{formatRange(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
                  {/* I5: the provider sets the rate and it stays negotiable. A range,
                      never a price. */}
                  Ranges, not prices. Each person sets their own rate and it stays
                  negotiable with you — we neither set it nor cap it. Our fee is charged
                  to you as a percentage of the job and never comes out of their hours.
                </p>
              </>
            )}
          </Prose>
        </Section>

        <Section title="Questions people ask" as="h2">
          <Prose>
            {page.questions.map((question) => (
              <div key={question.q} style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: 'var(--step-0)', marginBottom: '.35rem' }}>
                  {question.q}
                </h3>
                <p style={{ margin: 0 }}>{question.a}</p>
              </div>
            ))}
          </Prose>
        </Section>

        {nearby.length > 0 ? (
          <Section title="Related" as="h2">
            <Prose>
              <ul>
                {nearby.map((p) => (
                  <li key={crossedPath(p)}>
                    <Link href={crossedPath(p)}>{p.title}</Link>
                  </li>
                ))}
              </ul>
            </Prose>
          </Section>
        ) : null}

        <Section>
          <Prose>
            <p>
              <Link href="/how-it-works">How a referral works</Link>, or call us and we
              will go through it. Reviewed <span className="nums">{page.reviewedOn}</span>.
            </p>
          </Prose>
        </Section>
      </Stack>
    </>
  );
}
