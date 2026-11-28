import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CROSSED_PAGES, areaName } from '@/content/crossed';
import {
  areaSlug, asArea, asCareType, careDestination, crossedPath, type Area, type CareType,
} from '@/lib/crossed';
import { publicMetadata } from '@/lib/brand';
import { fieldStyle } from '@/components/SaveForm';
import { Prose, Section, Stack } from '@/components/layout';
import { AREA_OPTIONS, CARE_OPTIONS, PUBLIC_CARE_LABEL } from '@/lib/vocabulary';

/*
 * Request-dependent because the picker below is a GET form that submits to this page.
 * Declared rather than inferred: reading `searchParams` opts a route out of static
 * rendering on its own, and a reader of this file should not have to know that to know
 * what this route is.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = publicMetadata({
  title: 'Care by service and area',
  description:
    'What we are asked for, and the places we cover. Say which two and we will take you '
    + 'to the page about it, or straight to the form.',
}, '/care');

/**
 * THE INDEX FOR TEN PAGES THAT NOTHING LINKED TO.
 *
 * `/care/<service>/<area>` has shipped ten hand-written pages since W10 — each with its
 * own local detail, its own common cases, its own questions and a live rate table — and
 * not one link anywhere in the application pointed at any of them. They were reachable
 * from the sitemap and from a search engine and from nowhere else. A visitor who landed
 * on the Beverly Hills page could not find the Santa Monica one, and a visitor who
 * arrived at the front door could not find either.
 *
 * That is this codebase's signature failure in its public form: a surface that is
 * present, correct, tested, green and never reached. The console's five dead mechanisms
 * and the three intake routes with no form attached were the same defect, and the
 * question that catches it is the one `tests/doors.test.ts` is built around — for every
 * path, who reaches it.
 *
 * WHY THIS IS A QUESTION AND NOT A DIRECTORY. Seven services across ten places is
 * seventy pairs; ten pages exist. A grid of seventy links would be mostly dead ends, and
 * a list of the ten we happen to have written is a page about us rather than about what
 * somebody needs. So the picker asks the two questions the telephone call opens with,
 * and `careDestination` answers them: the curated page when there is one worth reading,
 * the enquiry form with both answers already filled in when there is not. The second is
 * not a consolation — an enquiry is the thing the business actually wants, and sixty of
 * the seventy pairs go straight to it.
 *
 * AND WHY IT IS A `method="get"` FORM. No JavaScript anywhere in it. The press is a
 * navigation, the result is a URL somebody can send to their sister, and the page it
 * lands on is the one a search engine would have sent them to. The three intake forms in
 * this repository were `<form onSubmit>` with no `action` for exactly as long as nobody
 * pressed one with JavaScript off; a picker built the same way would have been a button
 * that did nothing.
 */
export default function CareIndex({
  searchParams,
}: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <Body searchParams={searchParams} />;
}

async function Body({
  searchParams,
}: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const care = asCareType(params.care);
  const area = asArea(params.area);

  /*
   * Both answers given is the picker having been submitted, and the answer to it is
   * somewhere else. Validated through `asCareType`/`asArea` first, so a query string
   * somebody typed by hand cannot send a visitor to a 404 or anywhere off this site.
   */
  if (care && area) redirect(careDestination(care, area));

  const shown = CROSSED_PAGES.filter((page) => (
    (!care || page.rateKey === care) && (!area || page.area === areaSlug(area))
  ));

  return (
    <Stack gap="lg">
      <Section label="Century City and West Los Angeles" title="Care by service and area" as="h1">
        <Prose>
          <p className="lede">
            Two questions, which are the two the call opens with. Say what is needed and
            where, and we will take you to the page about it — or, where we have not
            written one, straight to the form with both answers already in it.
          </p>
        </Prose>
        <Picker care={care} area={area} />
      </Section>

      <Section title={listTitle(care, area, shown.length)} as="h2">
        {shown.length === 0 ? (
          <Prose>
            <p>
              We have written nothing about that yet, which says nothing about whether we
              can help with it. Ten pages is what there has been time to write; it is not
              the shape of the roster, and it is not a list of what we take on.
            </p>
            <p>
              <Link
                href={`/enquire${query(care, area)}`}
                className="btn btn-primary"
              >
                Ask us about it
              </Link>
            </p>
          </Prose>
        ) : (
          <>
            <p className="lede" style={{ marginBottom: '1.5rem' }}>
              Written by a person, reviewed on the date each one carries, and priced from
              the live table rather than from a figure typed into the page.
            </p>
            <div className="grid">
              {shown.map((page) => (
                <Link
                  key={crossedPath(page)}
                  href={crossedPath(page)}
                  className="cta-card"
                >
                  <p className="label">{areaName(page.area)}</p>
                  <h3>{PUBLIC_CARE_LABEL[page.rateKey as CareType] ?? page.rateKey}</h3>
                  <p className="cta-body">{page.summary}</p>
                  <p className="cta-go" aria-hidden>→</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </Section>

      {care || area ? (
        <Section>
          <p>
            <Link href="/care" className="btn">All ten pages</Link>
          </p>
        </Section>
      ) : null}

      <Section title="Where we work" as="h2">
        <Prose>
          <p>
            Close enough that somebody can get to you, and that we know who is good in
            your particular building or canyon. Somewhere else nearby? Ask anyway — we
            will tell you honestly whether we have anyone who can get to you.
          </p>
        </Prose>
        <p className="chips">
          {AREA_OPTIONS.filter((a) => a.value !== 'other').map((a) => (
            <Link key={a.value} href={`/care?area=${a.value}`} className="chip">
              {a.label}
            </Link>
          ))}
        </p>
      </Section>
    </Stack>
  );
}

/**
 * What the list below the picker is a list of.
 *
 * The empty heading is separate rather than a suffix, because the filtered one reads
 * badly when it is empty: "Not sure yet, by area" over a paragraph explaining that there
 * is nothing under it announces a list and then does not have one. `not_sure` is the
 * filter that lands here — it is a real answer on every form in this repository and by
 * design has no page — and so is any of the sixty pairings nobody has written about.
 */
function listTitle(care: CareType | null, area: Area | null, count: number): string {
  if (count === 0) return 'Nothing written about that yet';
  if (care && !area) return `${PUBLIC_CARE_LABEL[care]}, by area`;
  if (area && !care) return `Care in ${areaName(areaSlug(area))}`;
  return 'The pages we have written';
}

/** The two answers carried into the enquiry form, as a query string or nothing. */
function query(care: CareType | null, area: Area | null): string {
  const parts = [care ? `care=${care}` : null, area ? `area=${area}` : null]
    .filter((p): p is string => p !== null);
  return parts.length === 0 ? '' : `?${parts.join('&')}`;
}

/**
 * The two questions, as a plain GET form.
 *
 * `not_sure` is deliberately in the care list. It is a real answer, it is the one most
 * people have at four on a Friday, and it has no curated page — so it resolves to the
 * enquiry form with the place filled in, which is exactly right for somebody who knows
 * where they are and not what to call what they need.
 *
 * `other` is deliberately NOT in the area list here, although the enquiry form offers
 * it: this page is about the places we cover, and "somewhere else" is a sentence in the
 * prose below rather than an option that resolves to a page about nowhere.
 */
function Picker({ care, area }: { care: CareType | null; area: Area | null }) {
  return (
    <form method="get" action="/care" className="picker">
      <div className="picker-field">
        <label htmlFor="care">What kind of care</label>
        <select id="care" name="care" defaultValue={care ?? ''} style={fieldStyle}>
          <option value="">Choose one</option>
          {CARE_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <div className="picker-field">
        <label htmlFor="area">Where they are</label>
        <select id="area" name="area" defaultValue={area ?? ''} style={fieldStyle}>
          <option value="">Choose one</option>
          {AREA_OPTIONS.filter((a) => a.value !== 'other').map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn btn-primary">Show me</button>
    </form>
  );
}
