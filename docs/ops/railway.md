# Railway operations

Stickworld uses one Railway project with a public `web` service, a private
`worker` service, and cron processes built from the same repository. Keep the
service root at the repository root. Nixpacks detects the root `packageManager`
and `build` script, so this repository does not require a Dockerfile or a
custom Nixpacks file.

## Commands

| Process                   | Release command                          | Start command                                               | Public route                  |
| ------------------------- | ---------------------------------------- | ----------------------------------------------------------- | ----------------------------- |
| web                       | `pnpm db:migrate`                        | `pnpm --filter @stickworld/web start`                       | Yes; healthcheck `/v1/health` |
| worker                    | None; startup checks the Drizzle journal | `pnpm --filter @stickworld/worker start`                    | **No**                        |
| hourly cron               | None                                     | `pnpm --filter @stickworld/worker cron recompute-rankings`  | No                            |
| daily cron, 00:05 UTC     | None                                     | `pnpm --filter @stickworld/worker cron rotate-daily`        | No                            |
| season-close cron, manual | None                                     | `pnpm --filter @stickworld/worker cron close-season <slug>` | No                            |

The web release command must finish before the new web process starts. It uses
the direct connection while long-lived web, worker, and cron processes use the
pooled connection. The worker refuses to enter its job loop if any migration
listed by the committed Drizzle journal is absent from the database or has a
different hash.

Do not create a Railway domain or TCP proxy for the worker. It does not bind an
HTTP server. Railway should probe only the web service at `/v1/health`.

## Environment variable names

Configure only the names each service needs; store values in Railway, never in
the repository.

| Service | Names                                                                                                 |
| ------- | ----------------------------------------------------------------------------------------------------- |
| web     | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `ATTEMPT_HMAC_SECRET`, `NEON_AUTH_*`, `STICKWORLD_TELEMETRY` |
| worker  | `DATABASE_URL`, `STICKWORLD_TELEMETRY`                                                                |
| cron    | `DATABASE_URL`, `STICKWORLD_TELEMETRY`                                                                |

Before every production release, inspect the effective variables, including
shared/project-level variables:

- [ ] Production web does not list `GEMINI_API_KEY`.
- [ ] Production web does not list `DEEPGRAM_API_KEY`.
- [ ] Production web does not list `OPENROUTER_API_KEY`.
- [ ] Production worker does not list `GEMINI_API_KEY`.
- [ ] Production worker does not list `DEEPGRAM_API_KEY`.
- [ ] Production worker does not list `OPENROUTER_API_KEY`.
- [ ] Telemetry is enabled on web, worker, and cron.

Do not check these boxes from repository inspection. They require a live
Railway environment-variable listing.

## Release check

1. Confirm the build and web release command succeeded.
2. Confirm `/v1/health` returns HTTP 200 with only the generic health body.
3. Confirm a web request produces an `attempt.issue` or `attempt.finish` JSON
   line and a worker verification produces `verify.ok` or `verify.reject`
   followed by `verify.duration_ms`.
4. Confirm the worker has no public route and begins processing only after its
   migration check succeeds.
5. Use `docs/ops/rollback.md` if either service regresses.
