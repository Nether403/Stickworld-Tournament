# ADR-0004 — Spec 2 platform stack

**Status:** accepted for Spec 2 deepening (2026-08-18)
**Spec:** 2

## Context

Spec 2's scope draft left five open questions. Spec 1 landed on Branch A, so the
worker runtime is Node. The remaining questions would otherwise be re-litigated
during implementation.

## Decisions

1. **API lives in Next.js App Router route handlers** under `apps/web`, not a
   separate Fastify service. Railway still has two long-lived services (`web`,
   `worker`) plus cron. Fewer moving parts, one deployable frontend+API.
2. **SQL layer is Drizzle** with `node-postgres` (`pg`) on the pooled Neon
   connection. Migrations use Drizzle Kit against the **direct** (non-pooled)
   connection. No Prisma engine.
3. **Production Neon compute autosuspend is disabled.** Preview/CI branches
   may autosuspend. A competitive season must not cold-start mid-attempt.
4. **Championship recompute** is dirty-flag driven with a 30-second floor,
   plus an hourly cron safety net. Season close is an explicit cron job.
5. **"Best 6 of 10" does not ship in Spec 2.** Schema may reserve a snapshot
   `scope` value; no UI, no tests that require it.
6. **OAuth providers at launch are Google and GitHub.** The original brief
   named Discord. Neon Managed Better Auth's documented first-party providers
   are currently Google, GitHub, and Vercel (`signIn.social` / CLI). Discord
   is not listed. GitHub replaces Discord so we stay on managed Auth (which
   branches with the database) and do not add a third vendor or self-host
   Better Auth. If Neon later exposes Discord, it can be added as a third
   mapped provider without a schema change.
7. **Email/password and magic-link stay out of scope.** Neon Auth can send
   email; using it would still be an email-dependent flow we are not designing.
   Confirm the bundled sender only if a later spec wants magic-link.

## Pins (as of 2026-08-18)

Exact versions for Spec 2 implementation. Bump only with a note in this ADR.

| package | version |
|---|---|
| `next` | `16.3.1` |
| `react` / `react-dom` | `19.2.8` |
| `drizzle-orm` | `0.45.2` |
| `drizzle-kit` | `0.31.10` |
| `pg` | `8.23.0` |
| `@neondatabase/auth` | `0.5.0-beta` |

Neon CLI `neon-auth oauth-provider` `--provider-id` values: `google`, `github`,
`vercel`. Discord is not in that list. Next 16 uses `proxy.ts` instead of
`middleware.ts`. Do not add `@neondatabase/serverless`; Railway is long-lived.

## Consequences

- Spec 2 tasks can name packages, files, and numeric limits.
- Identity tests use Google (shared Neon credentials in dev) and GitHub
  (custom OAuth app) rather than Discord.
- Ranked gameplay in Spec 2 is Test Chamber only. Shipping titles arrive in
  Specs 3–4 via the same `game_versions` pin.

## Project (2026-08-18)

Neon project `still-mouse-62565389` (org Nether). Production compute
`suspend_timeout_seconds = 0` (autosuspend off), confirmed on the default
endpoint.

Managed Auth is provisioned. Email/password is **disabled**. Google uses
Neon shared credentials in development. GitHub is in the client UI but
requires a GitHub OAuth app in the Neon console (`add_oauth_provider`
rejects shared GitHub). Neon Auth's bundled sender exists
(`auth@mail.myneon.app`); Spec 2 still does not use email.

CI job `schema` needs repository secrets `NEON_API_KEY` and
`NEON_PROJECT_ID=still-mouse-62565389`. Forks skip when those are missing;
this repository fails the job if they are unset. GitHub OAuth is a Neon
console credential paste — shared GitHub is not offered.
