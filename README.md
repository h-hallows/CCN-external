# ccn-web — the public platform

Marketing site, client portal, provider portal and partner portal. Consumer of
`@ccn/core`, which owns the database, the credential engine, the care vocabulary and
the copy-lint ruleset.

> **This repository cannot `npm install` yet.** `@ccn/core` is not published. See
> "What has to happen before this builds" below. Until then the authoritative copy of
> this code is `apps/web` in the CCN-Registry workspace, and **only one of the two
> should be edited.**

## What this is

| | |
|---|---|
| `app/(marketing)` | Static, indexable. Home, how it works, rates, vetting, for providers, for partners. |
| `app/(client)` | The household portal — the bench, provider profiles. Dynamic, noindex. |
| `app/api` | The three public intake routes. They write to `inquiries` and `provider_applications` and nowhere else. |
| `content/statutory` | The operative legal artifacts. Six documents, versioned, imported and never retyped. |
| `lib/brand.ts` | The only place the business name may appear. |

## The rules this repository is built under

Three are enforced rather than described, and all three fail the build:

- **`ccn-lint`** — forbidden copy and forbidden identifiers. The statutory directory is
  excepted for the statutory phrases only; the advertising bans hold even there.
- **`brand-lint`** — no literal business name anywhere. The trading name is blocked on
  counsel, so clearing it must be two environment variables rather than a
  find-and-replace across six statutory documents.
- **`StatutoryFooter`** — throws during a production deploy if the § 1812.5095(h) line
  or the § 1812.533(b)(2) contact is missing. A local build renders a loud placeholder
  instead; the gate stops shipping, not work.

Nothing here may write to `referrals`, `timeline_entries` or `disclosures`. A test scans
every source file for it, and in deployment the database role does not hold the
privilege either.

## What has to happen before this builds

1. Publish `@ccn/core@0.1.0` to GitHub Packages. Needs a token with `write:packages`.
2. Set `GITHUB_PACKAGES_TOKEN`, a read-only PAT, on this project in Vercel for all three
   environments. `.npmrc` already reads it.
3. `npm install`.

Then delete `apps/web` from the CCN-Registry workspace, so there is one copy again.

## Environment

| Variable | What it is |
|---|---|
| `DATABASE_URL` | pooled connection |
| `NEXT_PUBLIC_LEGAL_NAME` | the registry's correct name as filed — blocked on counsel |
| `NEXT_PUBLIC_DISPLAY_NAME` | marketing name, only once counsel confirms a DBA is acceptable |
| `NEXT_PUBLIC_PHONE` or `NEXT_PUBLIC_STREET` | required in every advertisement by § 1812.533(b)(2) |
| `NEXT_PUBLIC_SITE_URL` | canonical origin |
| `GITHUB_PACKAGES_TOKEN` | read-only, to install `@ccn/core` |

Vercel: Root Directory `/`, domain apex plus `/portal`, `/pro`, `/partner` as paths
rather than subdomains — one certificate, one cookie scope.

*Not legal advice. The texts in `content/statutory` need counsel before any referral is
made under them.*
