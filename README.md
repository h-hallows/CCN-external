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
npm install
npm run dev        # port 3003
npm run ci         # copy lint, brand lint, typecheck, tests
```

## Environment

| Variable | What it is |
|---|---|
| `DATABASE_URL` | pooled connection to the one Postgres |
| `NEXT_PUBLIC_LEGAL_NAME` | the name shown everywhere. A stand-in renders the whole site; see the next row. |
| `NEXT_PUBLIC_NAME_IS_FILED` | `1` only once the name above is the registry's name **as filed**. Nothing infers it, and without it the site renders in full and is never indexed — § 1812.533(b)(2) wants the correct name in every advertisement, and an indexed page is advertised. |
| `NEXT_PUBLIC_DISPLAY_NAME` | marketing name, only once counsel confirms a DBA is acceptable |
| `NEXT_PUBLIC_PHONE` or `NEXT_PUBLIC_STREET` | required in every advertisement by § 1812.533(b)(2) |
| `NEXT_PUBLIC_SITE_URL` | canonical origin |
| `RESEND_API_KEY` | mail provider key. **Without it nobody can sign in**: in production there is no console driver and no link is printed. |
| `MAIL_FROM` | a sender on a domain Resend has verified |
| `MAIL_REPLY_TO` | optional, where replies go |
| `OPERATOR_NOTIFY_EMAIL` | where "something arrived" goes. The message never carries a name, an address or any clinical detail — § 7 keeps that in the console. |

`@h-hallows/core` is a public repository installed from a git tag, so `npm install`
needs no token and no registry configuration, here or on Vercel.

Vercel: Root Directory `/`. The portals are paths — `/portal`, `/pro`, `/partner` — not
subdomains, so there is one certificate and one cookie scope.

*Not legal advice. The texts in `content/statutory` need counsel before any referral is
made under them.*
