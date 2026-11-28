import Link from 'next/link';
import type { Metadata } from 'next';
import { Prose, Section, Stack } from '@/components/layout';
import { DISPLAY_NAME, LEGAL_NAME, publicMetadata, brandBlockers } from '@/lib/brand';
import { AREA_OPTIONS, CARE_OPTIONS } from '@/lib/vocabulary';

export const metadata: Metadata = publicMetadata({
  // `absolute`, or the root template appends the name to itself.
  title: { absolute: DISPLAY_NAME },
  description:
    'A private nursing and caregiver referral registry serving Century City and West '
    + 'Los Angeles. We refer; you engage directly.',
}, '/');

/**
 * LocalBusiness only. Never MedicalBusiness, HomeHealthCareService, Physician or
 * Hospital — those imply licensed clinical provision and run at § 1726(b) and
 * § 1812.533(b)(4). No aggregateRating, because there are no public ratings. No
 * priceRange, which would go stale. No award, licence or accreditation property.
 */
const jsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: LEGAL_NAME,
  description:
    'A private nursing and caregiver referral registry serving Century City and West '
    + 'Los Angeles.',
  address: { '@type': 'PostalAddress', addressLocality: 'Los Angeles', addressRegion: 'CA' },
  areaServed: [
    'Century City', 'Beverly Hills', 'Westwood', 'Brentwood', 'Bel Air',
    'Holmby Hills', 'Santa Monica', 'Pacific Palisades', 'Malibu',
  ],
});

/** The care types, minus `not_sure` — that is an answer on a form, not a service. */
const SERVICES = CARE_OPTIONS.filter((c) => c.value !== 'not_sure');

export default function Home() {
  return (
    <>
      {/*
        * Structured data is the strongest advertisement on the page — a search engine
        * reads LocalBusiness as the identity of the business, not as decoration. While
        * the name is unresolved this was emitting `"name": "PENDING_LEGAL_NAME"` with
        * the full description, beneath a body saying the site is not published. Nothing
        * is claimed until there is a correct name to claim it under, which is what
        * § 1812.533(b)(2) asks for.
        */}
      {brandBlockers().length === 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }}
        />
      ) : null}

      <Stack gap="lg">
        <Section>
          <p className="label">Century City and West Los Angeles</p>
          <h1>Care at home, arranged by someone who answers the phone.</h1>
          <p className="lede">
            We are a referral registry. We keep a small roster of experienced nurses and
            caregivers, we check their credentials against the issuing source, and when
            you call we put forward the two or three who actually fit — not a directory
            to search.
          </p>
          {/*
            * The first thing on the site that a reader can do. Until now the homepage's
            * only action was a link to a page explaining the business, and the enquiry
            * route it should have pointed at had no form attached to it at all.
            */}
          <p style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem', marginTop: '1.75rem' }}>
            <Link href="/enquire" className="btn btn-primary">Arrange care</Link>
            <Link href="/how-it-works" className="btn">How it works</Link>
          </p>
          <p style={{ marginTop: '1.25rem', color: 'var(--ink-2)' }}>
            You engage the provider directly and agree the rate with them. We make the
            introduction, hold the paperwork, and stay reachable when something changes
            at eight on a Sunday morning.
          </p>
        </Section>

        <Section title="What we are asked for" as="h2">
          <p className="lede" style={{ marginBottom: '1.5rem' }}>
            Most people arrive with one of these and are not sure which. That is what the
            call is for.
          </p>
          <div className="grid">
            {SERVICES.map((s) => (
              <Link
                key={s.value}
                href={`/enquire?care=${s.value}`}
                className="card"
                style={{ textDecoration: 'none', color: 'var(--ink)', display: 'block' }}
              >
                <h3 style={{ color: 'var(--accent)' }}>{s.label}</h3>
                <p style={{ fontSize: 'var(--step--1)', color: 'var(--ink-2)', margin: 0 }}>
                  {s.note}
                </p>
              </Link>
            ))}
          </div>
        </Section>

        <Section title="How an introduction actually goes" as="h2">
          <ol className="steps">
            <li>
              <strong>You call, or you send the form.</strong> If somebody is discharging
              today we move today.
            </li>
            <li>
              <strong>We ask what the days look like.</strong> Who is around, what has
              been tried, what the hard part is. Nobody is matched off a dropdown.
            </li>
            <li>
              <strong>We put forward two or three people.</strong> With their rate, what
              they have actually done, and what they have said they will and will not
              take. Everyone on that list has had their credentials checked against the
              body that issued them.
            </li>
            <li>
              <strong>You meet them, and you choose.</strong> You engage whoever you
              choose, directly, and agree the rate with them.
            </li>
            <li>
              <strong>We stay reachable.</strong> When somebody is ill, or the hours
              change, or it is not working — that is the call we are actually here for.
            </li>
          </ol>
          <p style={{ marginTop: '1.5rem' }}>
            <Link href="/how-it-works" className="btn">The longer version</Link>
          </p>
        </Section>

        <Section title="What we are not" as="h2">
          <Prose>
            <p>
              We are a referral registry, not an agency that sends staff. The provider is
              not ours; they are referred to you, and the working relationship is between
              you and them. That distinction is the whole legal shape of this business and
              we would rather be plain about it than have it surface later.
            </p>
            <p>
              We do not provide home care agency services, and we do not direct or
              supervise how a referred provider does their work.
            </p>
            <p className="aside-note">
              It also means we charge you and never them. Our fee is a fixed percentage
              of the engagement, agreed before any introduction is made, and a provider
              is never charged anything of any kind.{' '}
              <Link href="/pricing">What care costs here</Link>.
            </p>
          </Prose>
        </Section>

        <Section title="Where we work" as="h2">
          <Prose>
            <p>
              Close enough that somebody can get to you, and that we know who is good in
              your particular building or canyon.
            </p>
          </Prose>
          {/*
            * NINE PLACE NAMES THAT WENT NOWHERE, UNDER A HEADING ABOUT WHERE WE WORK.
            *
            * These were `span`s. Meanwhile ten hand-written pages about these exact
            * places had shipped under `/care/<service>/<area>` and nothing in the
            * application linked to a single one of them — the most specific words on the
            * site sitting inches from the pages written about them.
            *
            * Each one now goes to `/care?area=`, which lists what we have written about
            * that place and asks the second question. Not straight to a curated page:
            * four of the nine have one page, two have two, and three have none at all,
            * so a chip that sometimes landed on a page about a service nobody asked for
            * and sometimes on a 404 would be worse than a span. `.chip` carries the 44px
            * target the inline version did not have at 33.7px.
            */}
          <p className="chips">
            {AREA_OPTIONS.filter((a) => a.value !== 'other').map((a) => (
              <Link key={a.value} href={`/care?area=${a.value}`} className="chip">
                {a.label}
              </Link>
            ))}
          </p>
          <p style={{ marginTop: '1rem', fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
            Somewhere else nearby? Ask anyway — we will tell you honestly whether we have
            anyone who can get to you.
          </p>
          <p style={{ marginTop: '1.25rem' }}>
            <Link href="/care" className="btn">Care by service and area</Link>
          </p>
        </Section>
      </Stack>
    </>
  );
}
