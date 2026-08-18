# `@stickworld/db`

Drizzle schema, migrations, and seed for Spec 2. Kit uses `DATABASE_URL_UNPOOLED`
(direct). The API and worker use `DATABASE_URL` (pooled).

## Migrate / seed

```bash
pnpm --filter @stickworld/db migrate
pnpm --filter @stickworld/db seed
```

## Rollback

Drizzle Kit does not ship a one-command down-migrate for this repo.

To roll back the initial schema on a throwaway Neon branch:

```bash
psql "$DATABASE_URL_UNPOOLED" -f packages/db/drizzle/0000_init.down.sql
# then drop the Drizzle journal so up-migrate can re-run:
psql "$DATABASE_URL_UNPOOLED" -c 'DROP SCHEMA IF EXISTS drizzle CASCADE'
```

Or:

```bash
pnpm --filter @stickworld/db exec tsx -e 'import { rollbackInitial } from "./src/migrate.ts"; await rollbackInitial()'
```

Then re-apply with:

```bash
pnpm --filter @stickworld/db migrate
pnpm --filter @stickworld/db seed
```

`0001_gigantic_blade.sql` makes `ranking_dirty.dirty_at` nullable so recompute can
clear the flag. Production seasons are not rolled back; they are version-pinned.

## CI

`.github/workflows/ci.yml` job `schema` creates a Neon branch, migrates, rolls
back, migrates again, seeds, runs schema + platform integration tests, and
deletes the branch. This repository needs GitHub secrets `NEON_API_KEY` and
`NEON_PROJECT_ID`. Forks skip when those secrets are absent.
