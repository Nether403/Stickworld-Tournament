# Neon operations

Production uses Neon project `still-mouse-62565389`.

## Production compute

Production `suspend_timeout_seconds` is **0**: autosuspend is disabled. Keep it
disabled so an active competitive season cannot cold-start during an attempt.
Preview, CI, and restore-drill branches may autosuspend.

After an endpoint change, confirm the production endpoint in the Neon console
still reports an autosuspend value of `0`. This is a live configuration check,
not a repository default.

## Connections and migrations

- Web, worker, and cron use the pooled connection for application queries.
- `pnpm db:migrate` uses the direct, unpooled connection.
- Run migrations as the web release command before starting the new web
  deployment.
- The worker independently fails startup when its committed migration history
  is not fully applied.

Production is never down-migrated. If an applied schema change and an
application rollback conflict, roll the application back only when compatible
and ship a forward schema fix. Down scripts are for disposable branches as
described in `packages/db/README.md`.

## Restore drills

Point-in-time recovery creates a new `restore-drill-*` branch. It never resets,
rewinds, or down-migrates production. Follow `docs/ops/pitr-restore.md`, retain
the command output and ranking checksums as evidence, then delete the drill
branch.
