# CCN — public platform

The marketing site and the three portals: household, provider and partner.

The internal operator console is a separate repository,
[CCN-Registry](https://github.com/h-hallows/CCN-Registry), which also owns the database.
This repository consumes that as `@h-hallows/core` and **owns no schema** — no
migrations, no `drizzle-kit`, and no second copy of the credential engine. CI fails if
any of those appear.

## Layout

| | |
|---|---|
| `app/(marketing)` | Home, how it works, rates, vetting, for providers, for partners. Static and indexable. |
| `app/(client)` | The household portal — the published bench and provider profiles. Dynamic, noindex. |
| `app/api` | Three public intake routes. They write to `inquiries` and `provider_applications` and nowhere else. |
| `app/invite/[token]`, `app/login` | Invite-only access. There is no public signup for either portal. |
| `content/statutory` | Six documents, versioned. The operative legal artifacts of the business. |
| `lib/brand.ts` | The only place the business name may appear. |

## Three rules that fail the build

- **`ccn-lint`** — forbidden copy and forbidden identifiers. `content/statutory/` is
  excepted for the statutory phrases, because § 1812.5095(f) contains "independent
  contractor" and § 1812.533(b)(4) contains "home health agency" — the statutes put them
  there, while § 1812.5095(g) bars the registry from using those labels in its own copy.
  The advertising bans hold even inside that directory.
- **`brand-lint`** — no literal business name anywhere. The trading name is blocked on
  counsel, so clearing it must be two environment variables rather than a
  find-and-replace across six statutory documents.
- **`StatutoryFooter`** — throws during a production deploy if the § 1812.5095(h) line
  or the § 1812.533(b)(2) contact is missing. Local builds render a loud placeholder
  instead; the gate stops shipping, not work.

Nothing here may write to `referrals`, `timeline_entries` or `disclosures`. A test scans
every source file, and in deployment the database role does not hold the privilege.

## The three doors

`/enquire` for a household, `/refer` for a discharge planner, `/apply` for a nurse. Each
posts to its own route under `app/api`, which validates against the same strict schema it
stores from, rate-limits by hashed caller and carries a honeypot.

Two of the three had no door on them. `/api/inquiry` and `/api/apply` were deployed,
validated and reachable from nothing — the whole application contained exactly one
`fetch(` and it went to `/api/refer` — and `/refer` itself was linked from two places,
both inside the partner portal, which needs an invite from an operator. A discharge
planner had to already be a customer to find the form that makes them one.

`tests/doors.test.ts` is the rule that came out of it, and it is a rule rather than three
assertions: **every route under `app/api` that accepts a POST must be named by something
on the site that posts to it.** A fourth intake route added later is covered by the same
test. It also checks that every internal link resolves to a page, that every page is in
the sitemap, and that no page inherits the root layout's canonical URL — seven of the
eight public pages had been declaring the homepage as theirs, which is invisible under
`noindex` and collapses the site to one indexable URL the day a filed name is configured.

`lib/vocabulary.ts` is the one public-facing list of care types, areas, urgencies and the
rest. The wording is deliberately not core's — a console column is read by somebody who
already knows what it means, and a household reading a form has not met us — but the SET
is asserted against core's, so a care type added there fails the build here until
somebody chooses the household's wording for it.

## The two stand-ins

`lib/brand.ts` holds two placeholder phone values, and this is the trap: `PHONE` falls
back to `PENDING_PHONE` once a filed name is claimed, and to the prose `"Telephone
pending"` before that. Every check compared against the first, so on a deployment with no
name filed the site considered itself to have a telephone number — four screens served
"call us on Telephone pending — someone will pick up", and `/api/health` reported
`"contact": true` at the same time.

So there are two questions and they are two functions. **`contactLine()` is what to
print** — it still returns the prose before launch, because a blank footer is a footer
somebody ships without noticing. **`contactResolved()` is whether there is a contact
somebody can use**, and it is the only thing that may decide whether a page tells a
reader to telephone. A call site comparing `PHONE` to one sentinel fails
`tests/vocabulary.test.ts`.

## Running it

```bash
npm install
npm run dev        # port 3003
npm run ci         # copy lint, brand lint, typecheck, tests
```

## Environment

**`.env.example` is the list.** Every variable is there with what happens when it is
unset, and `tests/documentation.test.ts` fails if the code reads one the template does
not mention, or the template asks for one nothing reads. This section deliberately does
not repeat it: a table and a template that both claim to be the list is two things to
keep in step, and the one that rots is the one nobody copies.

Two properties of this application's configuration are worth knowing before you read it.

**Every `NEXT_PUBLIC_*` value is inlined at build time.** Changing one in a hosting
dashboard does nothing to a deployment that was already built. Redeploy after saving, or
the site goes on serving the value it was compiled with.

**Nothing crashes when a variable is missing.** Each one has a defined unset state and
the page says what is true in it — "Telephone pending" rather than a number somebody
could dial, a marked placeholder naming who owes a figure rather than a plausible
invented one, a site that renders in full and is never indexed rather than one indexed
under a name nobody filed. That is deliberate, and it is also why an incomplete
deployment looks finished. `/api/health` is the thing that will tell you otherwise.

## Deploying

Vercel, Root Directory `/`. The portals are paths — `/portal`, `/pro`, `/partner` — not
subdomains, so there is one certificate and one cookie scope.

`@h-hallows/core` is a public repository installed from a git tag, so `npm install` needs
no token and no registry configuration, here or on Vercel.

**There is one database and this repository does not own it.** The console
([CCN-Registry](https://github.com/h-hallows/CCN-Registry)) owns the schema and applies
every migration; this application only reads and writes rows. So provision the database
there, apply the schema there, and then point this project at the **same pooled
connection string**. There is no migration step in this deployment and there should
never be one.

Then, in the Vercel project:

1. `DATABASE_URL` — the pooled connection, with `?sslmode=require`. Without it the
   marketing pages still serve and everything behind a sign-in returns an explicit
   "unavailable" page: `/login`, `/portal`, `/pro`, `/partner`, `/invite/[token]` and
   every route under `/api`.
2. `RESEND_API_KEY` and `MAIL_FROM` — a sender on a domain Resend has verified.
   **Without both, nobody can sign in at all.** In production there is no console mail
   driver, so no link is printed anywhere and none can be recovered; the sign-in form
   refuses every address identically, which is the correct behaviour and also means an
   empty value looks like success.
3. `NEXT_PUBLIC_SITE_URL` — the canonical origin. Unset, a Vercel deployment falls back
   to the host's own production URL, so the sitemap is valid and may name the wrong
   hostname.
4. `NEXT_PUBLIC_LEGAL_NAME`, plus `NEXT_PUBLIC_PHONE` or `NEXT_PUBLIC_STREET` —
   § 1812.533(b)(2) wants the correct name and one of them in every advertisement.
5. `NEXT_PUBLIC_NAME_IS_FILED=1` — **only** once the configured name is the filed one.
   This is what makes the marketing pages indexable, and nothing infers it.
6. Redeploy. Steps 3 to 5 are `NEXT_PUBLIC_*` and do not reach a build that already
   happened.
7. Check `/api/health`. It needs no sign-in, returns nothing about any household or
   provider, and reports the database state and which brand facts are still missing.

The figures on `/pricing` and the five commitments on `/privacy` are separate, and they
are business facts rather than configuration — `.env.example` says who owes each one.
Until they are supplied those pages mark them as unfilled, which is accurate; it is not
a state to launch in.

*Not legal advice. The texts in `content/statutory` need counsel before any referral is
made under them.*
