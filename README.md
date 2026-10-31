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

## Running it

```bash
npm install        # needs GITHUB_PACKAGES_TOKEN; see "Before this installs"
npm run dev        # port 3003
npm run ci         # copy lint, brand lint, typecheck, tests
```

## Before this installs

`@h-hallows/core` has to be published to GitHub Packages from CCN-Registry. See
`PUBLISHING.md` there. Until it is, this repository cannot `npm install`, and the
authoritative copy of this code is whatever CCN-Registry's history last pushed here.

## Environment

| Variable | What it is |
|---|---|
| `DATABASE_URL` | pooled connection to the one Postgres |
| `NEXT_PUBLIC_LEGAL_NAME` | the registry's correct name as filed — **blocked on counsel** |
| `NEXT_PUBLIC_DISPLAY_NAME` | marketing name, only once counsel confirms a DBA is acceptable |
| `NEXT_PUBLIC_PHONE` or `NEXT_PUBLIC_STREET` | required in every advertisement by § 1812.533(b)(2) |
| `NEXT_PUBLIC_SITE_URL` | canonical origin |
| `GITHUB_PACKAGES_TOKEN` | read-only PAT, to install `@h-hallows/core` |

Vercel: Root Directory `/`. The portals are paths — `/portal`, `/pro`, `/partner` — not
subdomains, so there is one certificate and one cookie scope.

*Not legal advice. The texts in `content/statutory` need counsel before any referral is
made under them.*
